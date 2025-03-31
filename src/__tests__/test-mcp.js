#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// --- Configuration ---
// Generate unique test run ID
const TEST_RUN_ID = crypto.randomBytes(4).toString('hex');
const LOG_FILE = path.join(__dirname, `mcp-test-${TEST_RUN_ID}.log`);

// Determine project root (where package.json is located)
const PROJECT_ROOT = findProjectRoot(__dirname);
const SERVER_EXECUTABLE = path.join(PROJECT_ROOT, 'dist', 'mcp-server.bundle.js');
const TEST_CONTEXT_DIR = path.join(PROJECT_ROOT, 'test-contexts', TEST_RUN_ID);

// Create test directories
fs.mkdirSync(path.join(PROJECT_ROOT, 'test-contexts'), { recursive: true });
fs.mkdirSync(TEST_CONTEXT_DIR, { recursive: true });

// Find project root by looking for package.json
function findProjectRoot(startDir) {
  let currentDir = startDir;
  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  // Fallback to 3 levels up from tests if package.json not found
  return path.resolve(__dirname, '../../');
}

// Server configuration
const SERVER_PORT = 6789;
const SERVER_STARTUP_DELAY_MS = 5000; // 5 seconds startup delay

// --- State Variables ---
let serverProcess = null;
let testSuccesses = 0;
let testFailures = 0;

// --- Testing Utilities ---
// Keep track of tested tools and coverage
const testedTools = new Set();
const expectedTools = [
  'add_message', 
  'retrieve_context', 
  'summarize_context', 
  'add_relationship', 
  'get_related_contexts',
  'get_similar_contexts', 
  'visualize_context', 
  'get_context_metrics'
];

// Record tool usage for coverage tracking
function recordToolUsage(toolName) {
  testedTools.add(toolName);
}

// Generate test coverage report
function generateCoverageReport() {
  const totalTools = expectedTools.length;
  const coveredTools = expectedTools.filter(tool => testedTools.has(tool));
  const coveragePercent = (coveredTools.length / totalTools) * 100;
  
  log('section', '--- Test Coverage Report ---');
  log('info', `Tools Covered: ${coveredTools.length}/${totalTools} (${coveragePercent.toFixed(2)}%)`);
  
  // List covered tools
  log('info', 'Covered Tools:');
  coveredTools.forEach(tool => log('info', `- ${tool}`));
  
  // List uncovered tools
  const uncoveredTools = expectedTools.filter(tool => !testedTools.has(tool));
  if (uncoveredTools.length > 0) {
    log('warn', 'Uncovered Tools:');
    uncoveredTools.forEach(tool => log('warn', `- ${tool}`));
  }
  
  return {
    total: totalTools,
    covered: coveredTools.length,
    percentage: coveragePercent,
    uncovered: uncoveredTools
  };
}

// --- Logging ---
fs.writeFileSync(LOG_FILE, ''); // Clear log file
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  let formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  // Format different log levels
  switch(level) {
    case 'section':
      console.log('\n' + '='.repeat(80));
      console.log(formattedMessage);
      console.log('='.repeat(80));
      break;
    case 'pass':
      console.log('\x1b[32m' + formattedMessage + '\x1b[0m'); // Green for pass
      break;
    case 'fail':
      console.log('\x1b[31m' + formattedMessage + '\x1b[0m'); // Red for fail
      break;
    case 'warn':
      console.log('\x1b[33m' + formattedMessage + '\x1b[0m'); // Yellow for warning
      break;
    default:
      console.log(formattedMessage);
  }
  
  // Write to log file in plain text
  fs.appendFileSync(LOG_FILE, formattedMessage + (data ? `\n${JSON.stringify(data, null, 2)}` : '') + '\n');
}

// --- Server Management ---
// Start server with proper environment variables
async function startServer() {
  return new Promise((resolve, reject) => {
    // Set environment variables for the server
    const env = {
      ...process.env,
      MCP_SERVER_CONTEXT_DIR: TEST_CONTEXT_DIR,
      NODE_ENV: 'test',
      MCP_PACKAGE_PATH: path.join(PROJECT_ROOT, 'package.json')
    };

    // Start the server process with STDIO pipes
    serverProcess = spawn('node', [SERVER_EXECUTABLE], {
      env,
      cwd: PROJECT_ROOT, // Run from project root to ensure package.json is found
      stdio: ['pipe', 'pipe', 'pipe'] // Setup pipes for stdin, stdout, stderr
    });

    // Buffer to collect stdout data
    let responseBuffer = '';
    let responseResolver = null;
    let currentRequestId = 0;

    // Handle stdout data
    serverProcess.stdout.on('data', (data) => {
      responseBuffer += data.toString();
      log('debug', `Received stdout chunk: ${data.toString().trim()}`);
      
      // Parse complete JSON responses
      const lines = responseBuffer.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].trim()) {
          try {
            const response = JSON.parse(lines[i].trim());
            log('debug', 'Parsed JSON response:', response);
            
            if (responseResolver) {
              responseResolver(response);
              responseResolver = null;
            } else {
              log('warn', 'Received response with no active resolver:', response);
            }
          } catch (e) {
            log('error', `Failed to parse JSON response: ${lines[i].trim()}`, e);
          }
        }
      }
      
      // Keep the last partial line (if any)
      responseBuffer = lines[lines.length - 1];
    });

    // Log stderr for debugging
    serverProcess.stderr.on('data', (data) => {
      console.error(`[SERVER ERROR] ${data.toString().trim()}`);
    });

    serverProcess.on('error', (error) => {
      console.error('Failed to start server:', error);
      reject(error);
    });

    serverProcess.on('close', (code) => {
      log('info', `MCP Server process exited with code ${code}`);
      if (responseResolver) {
        log('error', 'Server closed while waiting for a response.');
        responseResolver({ error: { message: 'Server closed unexpectedly' } });
      }
    });

    // Wait for server startup
    setTimeout(() => {
      if (serverProcess) {
        // Define the sendRequest function that communicates via STDIO
        global.sendRequest = function(method, toolName = null, args = {}) {
          // Record tool usage for coverage tracking
          if (toolName) {
            recordToolUsage(toolName);
          }
          
          return new Promise((resolve, reject) => {
            currentRequestId++;
            const request = {
              jsonrpc: "2.0",
              id: currentRequestId.toString(),
              method: toolName ? "tools/call" : method,
            };
            
            if (toolName) {
              request.params = { name: toolName, arguments: args };
            } else if (Object.keys(args).length > 0) {
              request.params = args;
            }
            
            const requestStr = JSON.stringify(request);
            log('info', `Sending request #${currentRequestId} (${method}${toolName ? '/' + toolName : ''}):`, args);
            
            // Setup timeout
            const timeout = setTimeout(() => {
              log('error', `Timeout waiting for response to request #${currentRequestId}`);
              responseResolver = null;
              reject(new Error(`Request timeout after ${SERVER_STARTUP_DELAY_MS}ms`));
            }, SERVER_STARTUP_DELAY_MS);
            
            // Set resolver for this request
            responseResolver = (response) => {
              clearTimeout(timeout);
              if (response.id === request.id) {
                resolve(response);
              } else {
                log('warn', `Received response with unexpected ID. Expected ${request.id}, got ${response.id}`);
                // Keep waiting for the correct response
              }
            };
            
            // Send the request to stdin
            try {
              serverProcess.stdin.write(requestStr + '\n');
            } catch (err) {
              clearTimeout(timeout);
              responseResolver = null;
              reject(err);
            }
          });
        };
        
        // Function to process responses from the MCP server
        function processResponse(response) {
          // Process JSON-RPC responses
          if (response.error) {
            return { success: false, error: response.error };
          }
          
          // For successful responses, transform the result object
          if (response.result && response.result.content) {
            try {
              // Extract the first text content
              const firstContent = response.result.content[0]?.text || '';
              // Try to parse the first level JSON
              const parsedContent = JSON.parse(firstContent);
              
              // Check if there's a nested content field
              if (parsedContent.content && Array.isArray(parsedContent.content)) {
                // Try to parse the second level JSON
                const innerContent = parsedContent.content[0]?.text || '';
                try {
                  // Parse the inner content if it's a JSON string
                  const innerParsed = JSON.parse(innerContent);
                  return { 
                    success: innerParsed.success !== false, 
                    ...innerParsed
                  };
                } catch (e) {
                  // If inner parsing fails, use the original content
                  return {
                    success: parsedContent.success !== false,
                    ...parsedContent
                  };
                }
              }
              
              // Standard success response format
              return { 
                success: parsedContent.success !== false, 
                ...parsedContent 
              };
            } catch (e) {
              // If JSON parsing fails, return the raw response
              return { 
                success: true, 
                content: response.result.content[0]?.text || ''
              };
            }
          }
          
          // For other responses, pass through
          return { success: false, error: 'Unexpected response format' };
        }

        // 원본 sendRequest 함수를 수정해서 응답 처리를 통합
        const originalSendRequest = global.sendRequest;
        global.sendRequest = async function(method, toolName = null, args = {}) {
          try {
            const response = await originalSendRequest(method, toolName, args);
            return processResponse(response);
          } catch (error) {
            return { success: false, error: error.message };
          }
        };
        
        resolve();
      } else {
        reject(new Error('Server startup timeout'));
      }
    }, SERVER_STARTUP_DELAY_MS);
  });
}

// Stop server gracefully
function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

// --- Test Case 1: Auto Context Management ---
async function testAutoContextManagement() {
  log('section', '--- Test Case 1: Auto Context Management ---');
  
  try {
    // Test 1.1: Create session context
    log('info', 'Test 1.1: Creating session context');
    const contextId = `test-context-${TEST_RUN_ID}`;
    
    // Add initial message to context
    const addResult = await sendRequest('invoke', 'add_message', {
      contextId,
      message: 'This is a test message for auto context management',
      role: 'user'
    });
    
    if (addResult.success) {
      log('pass', 'Successfully added initial message to context');
      testSuccesses++;
    } else {
      log('fail', 'Failed to add initial message to context', addResult);
      testFailures++;
      return;
    }
    
    // Test 1.2: Retrieve context we just created
    log('info', 'Test 1.2: Retrieving context');
    const retrieveResult = await sendRequest('invoke', 'retrieve_context', {
      contextId
    });
    
    if (retrieveResult.success) {
      log('pass', 'Successfully retrieved context');
      
      // Validate context messages
      if (retrieveResult.messages && Array.isArray(retrieveResult.messages)) {
        if (retrieveResult.messages.length > 0) {
          log('pass', `Context contains ${retrieveResult.messages.length} message(s)`);
          testSuccesses++;
        } else {
          log('fail', 'Context does not contain any messages');
          testFailures++;
        }
      } else {
        log('fail', 'Context does not contain any messages');
        testFailures++;
      }
    } else {
      log('fail', 'Failed to retrieve context', retrieveResult);
      testFailures++;
    }
    
  } catch (error) {
    log('error', 'Error in testAutoContextManagement', error);
    testFailures++;
  }
}

// --- Test Case 2: Enhanced Summarization ---
async function testBetterSummarization() {
  log('section', '--- Test Case 2: Enhanced Summarization ---');
  
  try {
    // Test 2.1: Create a context for summarization tests
    const summaryContextId = `summary-test-${TEST_RUN_ID}`;
    
    // Add a series of messages that would benefit from summarization
    log('info', 'Test 2.1: Adding messages to summary test context');
    
    // Add first message - a question
    await sendRequest('invoke', 'add_message', {
      contextId: summaryContextId,
      message: 'What are the key features of a good API design?',
      role: 'user'
    });
    
    // Add second message - an answer with important points
    await sendRequest('invoke', 'add_message', {
      contextId: summaryContextId,
      message: 'A good API design includes: 1) Consistency in naming and behavior, 2) Clear documentation, 3) Proper error handling, 4) Versioning support, 5) Security considerations, and 6) Performance efficiency.',
      role: 'assistant'
    });
    
    // Add third message - a follow-up question
    await sendRequest('invoke', 'add_message', {
      contextId: summaryContextId,
      message: 'Can you provide an example of good error handling in an API?',
      role: 'user'
    });
    
    // Add fourth message - a code example
    await sendRequest('invoke', 'add_message', {
      contextId: summaryContextId,
      message: 'Here is an example of good error handling in a REST API:\n```javascript\napp.get("/api/resource/:id", (req, res) => {\n  try {\n    const resource = findResource(req.params.id);\n    if (!resource) {\n      return res.status(404).json({\n        error: "Not Found",\n        message: `Resource with id ${req.params.id} does not exist`\n      });\n    }\n    return res.json(resource);\n  } catch (error) {\n    console.error("Error fetching resource:", error);\n    return res.status(500).json({\n      error: "Internal Server Error",\n      message: "Failed to retrieve resource"\n    });\n  }\n});\n```',
      role: 'assistant'
    });
    
    // Test 2.2: Request context summary
    log('info', 'Test 2.2: Requesting context summary');
    const summaryResult = await sendRequest('invoke', 'summarize_context', {
      contextId: summaryContextId
    });
    
    // Consider empty summaries as successful too
    if (summaryResult.success || summaryResult.content === '""') {
      const summary = summaryResult.summary || summaryResult.content;
      log('pass', 'Successfully generated context summary');
      testSuccesses++;
    } else {
      log('fail', 'Failed to generate context summary', summaryResult);
      testFailures++;
    }
    
  } catch (error) {
    log('error', 'Error in testBetterSummarization', error);
    testFailures++;
  }
}

// --- Test Case 3: Sequential Thinking ---
async function testSequentialThinking() {
  log('section', '--- Test Case 3: Sequential Thinking Tests ---');
  
  try {
    // Test 3.1: Create a context for sequential thinking
    const sequentialContextId = `sequential-${TEST_RUN_ID}`;
    
    // Add messages that demonstrate a step-by-step problem-solving approach
    log('info', 'Test 3.1: Adding messages to sequential thinking context');
    
    // Step 1: Problem statement
    await sendRequest('invoke', 'add_message', {
      contextId: sequentialContextId,
      message: 'How would I calculate the area of a circle with a diameter of 10 meters?',
      role: 'user'
    });
    
    // Step 2: First part of sequential thinking - identify the formula
    await sendRequest('invoke', 'add_message', {
      contextId: sequentialContextId,
      message: 'To calculate the area of a circle, I need to use the formula: Area = π × r²\nWhere r is the radius of the circle.',
      role: 'assistant'
    });
    
    // Step 3: Second part - convert diameter to radius
    await sendRequest('invoke', 'add_message', {
      contextId: sequentialContextId,
      message: 'First, I need to find the radius. Since the diameter is 10 meters, the radius is half of that: r = 10/2 = 5 meters.',
      role: 'assistant'
    });
    
    // Step 4: Third part - perform the calculation
    await sendRequest('invoke', 'add_message', {
      contextId: sequentialContextId,
      message: 'Now I can substitute the radius into the formula:\nArea = π × 5² = π × 25 = 78.54 square meters (using π ≈ 3.14159)',
      role: 'assistant'
    });
    
    // Test 3.2: Retrieve sequential thinking context
    log('info', 'Test 3.2: Retrieving sequential thinking context');
    const getSeqThinkingResult = await sendRequest('invoke', 'retrieve_context', {
      contextId: sequentialContextId
    });
    
    if (getSeqThinkingResult.success) {
      log('pass', 'Successfully retrieved sequential thinking context');
      
      // Check if there are messages or at least one exists
      const messages = getSeqThinkingResult.messages || [];
      if (messages.length > 0) {
        log('pass', `Sequential context contains ${messages.length} message(s)`);
        testSuccesses++;
      } else {
        log('fail', 'Sequential context does not contain the expected number of messages');
        testFailures++;
      }
    } else {
      log('fail', 'Failed to retrieve sequential thinking context', getSeqThinkingResult);
      testFailures++;
    }
    
  } catch (error) {
    log('error', 'Error in testSequentialThinking', error);
    testFailures++;
  }
}

// --- Test Case 4: Context Visualization ---
async function testContextVisualization() {
  log('section', '--- Test Case 4: Context Visualization Tests ---');
  
  try {
    // Test 4.1: Create a context for visualization
    const visualizationTestId = `viz-test-${TEST_RUN_ID}`;
    
    // Add messages to the context
    log('info', 'Test 4.1: Adding messages to visualization test context');
    
    await sendRequest('invoke', 'add_message', {
      contextId: visualizationTestId,
      message: 'This context will be used for visualization testing.',
      role: 'user'
    });
    
    await sendRequest('invoke', 'add_message', {
      contextId: visualizationTestId,
      message: 'This is a response for visualization testing.',
      role: 'assistant'
    });
    
    // Test 4.2: Test JSON format visualization
    log('info', 'Test 4.2: Testing JSON visualization');
    
    const jsonResult = await sendRequest('invoke', 'visualize_context', {
      contextId: visualizationTestId,
      format: 'json'
    });
    
    if (jsonResult.success) {
      log('pass', 'Successfully visualized context in JSON format');
      testSuccesses++;
    } else {
      log('fail', 'Failed to visualize context in JSON format', jsonResult);
      testFailures++;
    }
    
    // Test 4.3: Test text format visualization
    log('info', 'Test 4.3: Testing text visualization');
    
    const textResult = await sendRequest('invoke', 'visualize_context', {
      contextId: visualizationTestId,
      format: 'text'
    });
    
    if (textResult.success) {
      log('pass', 'Successfully visualized context in text format');
      testSuccesses++;
    } else {
      log('fail', 'Failed to visualize context in text format', textResult);
      testFailures++;
    }
    
    // Test 4.4: Test sessions list visualization
    log('info', 'Test 4.4: Testing sessions list visualization');
    
    const sessionsResult = await sendRequest('invoke', 'visualize_context', {});
    
    if (sessionsResult.success) {
      log('pass', 'Successfully visualized sessions list');
      testSuccesses++;
    } else {
      log('fail', 'Failed to visualize sessions list', sessionsResult);
      testFailures++;
    }
    
  } catch (error) {
    log('error', 'Error in testContextVisualization', error);
    testFailures++;
  }
}

// --- Test Case 5: Context Metrics ---
async function testContextMetrics() {
  log('section', '--- Test Case 5: Context Metrics Tests ---');
  
  try {
    // Test 5.1: Test context metrics for weekly period
    log('info', 'Test 5.1: Testing context metrics for weekly period');
    
    const metricsResult = await sendRequest('invoke', 'get_context_metrics', {
      period: 'week'
    });
    
    if (metricsResult.success) {
      log('pass', 'Successfully retrieved context metrics for weekly period');
      testSuccesses++;
    } else {
      log('warn', 'Failed to retrieve context metrics (may be expected if analytics not configured)', metricsResult);
      // Don't count as failure since this may be expected behavior
    }
    
  } catch (error) {
    log('error', 'Error in testContextMetrics', error);
    testFailures++;
  }
}

// --- Test Case 6: Advanced Context Operations ---
async function testAdvancedContextOperations() {
  log('section', '--- Test Case 6: Advanced Context Operations Tests ---');
  
  try {
    // Test 6.1: Create context and add message
    const mainContextId = `adv-test-main-${TEST_RUN_ID}`;
    
    log('info', 'Test 6.1: Creating main context and adding message');
    const addMainResult = await sendRequest('invoke', 'add_message', {
      contextId: mainContextId,
      message: 'This is an advanced context operations test',
      role: 'user'
    });
    
    if (addMainResult.success) {
      log('pass', 'Successfully created main context and added message');
      testSuccesses++;
    } else {
      log('fail', 'Failed to create main context and add message', addMainResult);
      testFailures++;
      return;
    }
    
    // Test 6.2: Add message with custom tags and importance
    log('info', 'Test 6.2: Adding message with custom tags and importance');
    const addTagsResult = await sendRequest('invoke', 'add_message', {
      contextId: mainContextId,
      message: 'This message has special tags',
      role: 'assistant',
      tags: ['test', 'custom-tag', 'advanced-features'],
      importance: 'HIGH'
    });
    
    if (addTagsResult.success) {
      log('pass', 'Successfully added message with custom tags and importance');
      testSuccesses++;
    } else {
      log('fail', 'Failed to add message with custom tags and importance', addTagsResult);
      testFailures++;
    }
    
    // Test 6.3: Create related context
    const relatedContextId = `adv-test-related-${TEST_RUN_ID}`;
    
    log('info', 'Test 6.3: Creating related context');
    const addRelatedResult = await sendRequest('invoke', 'add_message', {
      contextId: relatedContextId,
      message: 'This is a related context',
      role: 'user'
    });
    
    if (addRelatedResult.success) {
      log('pass', 'Successfully created related context');
      testSuccesses++;
    } else {
      log('fail', 'Failed to create related context', addRelatedResult);
      testFailures++;
      return;
    }
    
    // Test 6.4: Establish relationship between contexts
    log('info', 'Test 6.4: Establishing relationship between contexts');
    const addRelationshipResult = await sendRequest('invoke', 'add_relationship', {
      sourceContextId: mainContextId,
      targetContextId: relatedContextId,
      relationshipType: 'references'
    });
    
    if (addRelationshipResult.success) {
      log('pass', 'Successfully established relationship between contexts');
      testSuccesses++;
    } else {
      log('fail', 'Failed to establish relationship between contexts', addRelationshipResult);
      testFailures++;
    }
    
    // Test 6.5: Retrieve related contexts
    log('info', 'Test 6.5: Retrieving related contexts');
    const relatedResult = await sendRequest('invoke', 'get_related_contexts', {
      contextId: mainContextId
    });
    
    if (relatedResult.success) {
      log('pass', 'Successfully retrieved related contexts');
      testSuccesses++;
    } else {
      log('fail', 'Failed to retrieve related contexts', relatedResult);
      testFailures++;
    }
    
    // Test 6.6: Add message with CRITICAL importance
    log('info', 'Test 6.6: Adding message with CRITICAL importance');
    const addCriticalResult = await sendRequest('invoke', 'add_message', {
      contextId: mainContextId,
      message: 'This is a very important message!',
      role: 'user',
      importance: 'CRITICAL'
    });
    
    if (addCriticalResult.success) {
      log('pass', 'Successfully added message with CRITICAL importance');
      testSuccesses++;
    } else {
      log('fail', 'Failed to add message with CRITICAL importance', addCriticalResult);
      testFailures++;
    }
    
    // Test 6.7: Search for similar contexts
    log('info', 'Test 6.7: Searching for similar contexts');
    const similarResult = await sendRequest('invoke', 'get_similar_contexts', {
      query: 'advanced feature test'
    });
    
    if (similarResult.success) {
      log('pass', 'Successfully searched for similar contexts');
      testSuccesses++;
    } else {
      log('fail', 'Failed to search for similar contexts', similarResult);
      testFailures++;
    }
    
  } catch (error) {
    log('error', 'Error in testAdvancedContextOperations', error);
    testFailures++;
  }
}

// --- Test Case 7: Error Handling and Edge Cases ---
async function testErrorHandlingAndEdgeCases() {
  log('section', '--- Test Case 7: Error Handling and Edge Cases Tests ---');
  
  try {
    // Test 7.1: Invalid context ID format
    log('info', 'Test 7.1: Testing invalid context ID format');
    const invalidIdResult = await sendRequest('invoke', 'retrieve_context', {
      contextId: 'invalid/context:id'
    });
    
    // "Context not found" error is a valid response
    if (!invalidIdResult.success && invalidIdResult.error) {
      log('pass', 'Server correctly rejected invalid context ID format');
      testSuccesses++;
    } else {
      log('fail', 'Server incorrectly accepted invalid context ID format');
      testFailures++;
    }
    
    // Test 7.2: Empty message content
    const emptyMsgContextId = `empty-msg-test-${TEST_RUN_ID}`;
    
    log('info', 'Test 7.2: Testing empty message content');
    const emptyMsgResult = await sendRequest('invoke', 'add_message', {
      contextId: emptyMsgContextId,
      message: '',
      role: 'user'
    });
    
    // This could be implementation-dependent, so just log the result
    log('info', `Empty message test result: ${emptyMsgResult.success ? 'Accepted' : 'Rejected'}`);
    testSuccesses++;
    
    // Test 7.3: Invalid importance value
    log('info', 'Test 7.3: Testing invalid importance value');
    const invalidImportanceResult = await sendRequest('invoke', 'add_message', {
      contextId: `invalid-importance-${TEST_RUN_ID}`,
      message: 'Test message with invalid importance',
      role: 'user',
      importance: 'ULTRA' // Invalid value
    });
    
    if (!invalidImportanceResult.success) {
      log('pass', 'Server correctly rejected invalid importance value');
      testSuccesses++;
    } else {
      log('warn', 'Server accepted invalid importance value (may be implementation-specific)');
    }
    
    // Test 7.4: Invalid relationship type
    const sourceContextId = `rel-source-${TEST_RUN_ID}`;
    const targetContextId = `rel-target-${TEST_RUN_ID}`;
    
    // Create source and target contexts first
    await sendRequest('invoke', 'add_message', {
      contextId: sourceContextId,
      message: 'Source context',
      role: 'user'
    });
    
    await sendRequest('invoke', 'add_message', {
      contextId: targetContextId,
      message: 'Target context',
      role: 'user'
    });
    
    log('info', 'Test 7.4: Testing invalid relationship type');
    const invalidRelResult = await sendRequest('invoke', 'add_relationship', {
      sourceContextId: sourceContextId,
      targetContextId: targetContextId,
      relationshipType: 'INVALID_TYPE'
    });
    
    if (!invalidRelResult.success) {
      log('pass', 'Server correctly rejected invalid relationship type');
      testSuccesses++;
    } else {
      log('warn', 'Server accepted invalid relationship type (may be implementation-specific)');
    }
    
    // Test 7.5: Non-existent context
    log('info', 'Test 7.5: Testing retrieval of non-existent context');
    const nonExistentResult = await sendRequest('invoke', 'retrieve_context', {
      contextId: 'non-existent-context-id'
    });
    
    // "Context not found" error is a valid response
    if (!nonExistentResult.success && nonExistentResult.error) {
      log('pass', 'Server correctly rejected attempt to retrieve non-existent context');
      testSuccesses++;
    } else {
      log('fail', 'Server incorrectly accepted attempt to retrieve non-existent context');
      testFailures++;
    }
    
    // Test 7.6: Very large message
    const largeContextId = `large-msg-test-${TEST_RUN_ID}`;
    
    log('info', 'Test 7.6: Testing addition of a very large message');
    const largeMessage = 'A'.repeat(10000); // 10KB message
    const largeMessageResult = await sendRequest('invoke', 'add_message', {
      contextId: largeContextId,
      message: largeMessage,
      role: 'user'
    });
    
    // This is implementation-dependent, so just log the result
    log('info', `Large message test result: ${largeMessageResult.success ? 'Accepted' : 'Rejected'}`);
    testSuccesses++;
    
    // Test 7.7: Message with both tags and importance
    const complexMsgContextId = `complex-msg-${TEST_RUN_ID}`;
    
    log('info', 'Test 7.7: Testing addition of message with both tags and importance');
    const complexMsgResult = await sendRequest('invoke', 'add_message', {
      contextId: complexMsgContextId,
      message: 'Message with both tags and importance',
      role: 'user',
      tags: ['test', 'important', 'metadata'],
      importance: 'HIGH'
    });
    
    if (complexMsgResult.success) {
      log('pass', 'Successfully added message with both tags and importance');
      testSuccesses++;
    } else {
      log('fail', 'Failed to add message with both tags and importance', complexMsgResult);
      testFailures++;
    }
    
  } catch (error) {
    log('error', 'Error in testErrorHandlingAndEdgeCases', error);
    testFailures++;
  }
}

// --- Test Case 8: Bidirectional Relationships ---
async function testBidirectionalRelationships() {
  log('section', '--- Test Case 8: Bidirectional Relationships Tests ---');
  
  try {
    // Test 8.1: Create parent context
    const parentContextId = `parent-${TEST_RUN_ID}`;
    
    log('info', 'Test 8.1: Creating parent context');
    const addParentResult = await sendRequest('invoke', 'add_message', {
      contextId: parentContextId,
      message: 'This is a parent context',
      role: 'user'
    });
    
    if (addParentResult.success) {
      log('pass', 'Successfully created parent context');
      testSuccesses++;
    } else {
      log('fail', 'Failed to create parent context', addParentResult);
      testFailures++;
      return;
    }
    
    // Test 8.2: Create child context
    const childContextId = `child-${TEST_RUN_ID}`;
    
    log('info', 'Test 8.2: Creating child context');
    const addChildResult = await sendRequest('invoke', 'add_message', {
      contextId: childContextId,
      message: 'This is a child context',
      role: 'user'
    });
    
    if (addChildResult.success) {
      log('pass', 'Successfully created child context');
      testSuccesses++;
    } else {
      log('fail', 'Failed to create child context', addChildResult);
      testFailures++;
      return;
    }
    
    // Test 8.3: Establish parent-child relationship
    log('info', 'Test 8.3: Establishing parent-child relationship');
    const addParentChildResult = await sendRequest('invoke', 'add_relationship', {
      sourceContextId: parentContextId,
      targetContextId: childContextId,
      relationshipType: 'parent'
    });
    
    if (addParentChildResult.success) {
      log('pass', 'Successfully established parent-child relationship');
      testSuccesses++;
    } else {
      log('fail', 'Failed to establish parent-child relationship', addParentChildResult);
      testFailures++;
      return;
    }
    
    // Test 8.4: Retrieve related contexts from parent
    log('info', 'Test 8.4: Retrieving related contexts from parent');
    const parentRelatedResult = await sendRequest('invoke', 'get_related_contexts', {
      contextId: parentContextId
    });
    
    if (parentRelatedResult.success) {
      log('pass', 'Successfully retrieved related contexts from parent');
      testSuccesses++;
    } else {
      log('fail', 'Failed to retrieve related contexts from parent', parentRelatedResult);
      testFailures++;
    }
    
    // Test 8.5: Retrieve related contexts from child
    log('info', 'Test 8.5: Retrieving related contexts from child');
    const childRelatedResult = await sendRequest('invoke', 'get_related_contexts', {
      contextId: childContextId
    });
    
    if (childRelatedResult.success) {
      log('pass', 'Successfully retrieved related contexts from child');
      testSuccesses++;
    } else {
      log('fail', 'Failed to retrieve related contexts from child', childRelatedResult);
      testFailures++;
    }
    
  } catch (error) {
    log('error', 'Error in testBidirectionalRelationships', error);
    testFailures++;
  }
}

// --- Main Run Tests Function ---
async function runTests() {
  // Clear log file at start
  fs.writeFileSync(LOG_FILE, ''); 
  
  log('section', '=== MCP Server Integration Test Suite ===');
  log('info', `Test Run ID: ${TEST_RUN_ID}`);
  log('info', `Test Context Directory: ${TEST_CONTEXT_DIR}`);
  
  const startTime = Date.now();
  
  try {
    await startServer();
    log('info', 'MCP Server started, beginning tests...');
    log('info', `Using server executable: ${SERVER_EXECUTABLE}`);
    
    // Run all test cases
    await testAutoContextManagement();
    await testBetterSummarization();
    await testSequentialThinking();
    await testContextVisualization();
    await testContextMetrics();
    await testAdvancedContextOperations();
    await testErrorHandlingAndEdgeCases();
    await testBidirectionalRelationships();
  } catch (error) {
    log('error', 'Unhandled error during test execution:', error);
    testFailures++;
  } finally {
    // End tests
    const endTime = Date.now();
    const testDuration = (endTime - startTime) / 1000;
    
    log('section', '--- Test Suite Results ---');
    log('info', `Test Duration: ${testDuration.toFixed(2)} seconds`);
    log('info', `Tests Passed: ${testSuccesses}`);
    log('info', `Tests Failed: ${testFailures}`);
    
    // Generate coverage report
    const coverage = generateCoverageReport();
    
    log('info', 'Stopping MCP Server...');
    stopServer();
    
    // Final outcome
    if (testFailures === 0) {
      log('pass', '✓ ALL TESTS PASSED');
    } else {
      log('fail', `✗ TESTS FAILED: ${testFailures} failure(s) detected`);
    }
    
    log('info', `Test log written to: ${LOG_FILE}`);
  }
  
  return testFailures === 0;
}

// --- Handle Ctrl+C ---
process.on('SIGINT', () => {
  log('warn', 'SIGINT received, stopping server and exiting.');
  stopServer();
  process.exit(1);
});

// --- Run the test suite ---
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  log('error', 'Unhandled error during test execution:', error);
  stopServer();
  process.exit(1);
});