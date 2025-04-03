/**
 * Complex Development Scenario Integration Test
 *
 * This test simulates a real-world development scenario with an AI agent,
 * testing the system's ability to handle complex contexts including:
 * - Code snippets of various languages
 * - Technical discussions
 * - Architectural decisions
 * - Different query formulations
 * - Long and complex texts
 */
import fs from 'fs-extra';
import path from 'path';
import { initializeMcpServer, InitializedServices } from '../../main';
import { TOOL_NAMES, AddContextParams, GetContextParams } from '../../domain/types';

// Global test services object
let testServices: InitializedServices | null = null;

/**
 * Sets up the test environment by creating necessary directories and initializing services
 */
async function setupTestEnvironment(): Promise<InitializedServices> {
  // Create test temporary directory
  const tempDir = path.join(__dirname, '../../..', 'test-temp');
  await fs.ensureDir(tempDir);

  // Clean up any existing data in the temp directory
  await fs.emptyDir(tempDir);

  // Setup test environment variables
  process.env.MCP_CONTEXT_DIR = tempDir;
  process.env.MCP_USE_VECTOR_DB = 'true';
  process.env.MCP_USE_GRAPH_DB = 'true';

  // Initialize services using main.ts
  testServices = await initializeMcpServer();

  // Ensure the vector repository is properly initialized
  if (testServices.vectorRepository) {
    await testServices.vectorRepository.ensureInitialized();
  }

  return testServices;
}

/**
 * Cleans up the test environment after tests complete
 */
async function cleanupTestEnvironment(): Promise<void> {
  console.log('리소스 정리 중...');

  // Explicitly close the embedding model
  try {
    console.log('Embedding Model 정리 중...');
    const { EmbeddingUtil } = await import('../../utils/embedding');
    await EmbeddingUtil.getInstance().close();
    console.log('Embedding Model 세션 정리 완료');
  } catch (error) {
    console.error('Embedding Model 정리 중 오류 발생:', error);
  }

  if (testServices) {
    // Clean up resources if needed
    if (testServices.vectorRepository) {
      try {
        console.log('Vector Repository 정리 중...');
        await testServices.vectorRepository.close();
      } catch (error) {
        console.error('Vector Repository 정리 중 오류 발생:', error);
      }
    }

    if (testServices.graphRepository) {
      try {
        console.log('Graph Repository 정리 중...');
        // GraphRepository에는 close 메서드가 없으므로 직접적인 정리가 필요 없음
        console.log('Graph Repository 정리 완료');
      } catch (error) {
        console.error('Graph Repository 정리 중 오류 발생:', error);
      }
    }

    // Reset test services
    testServices = null;
  }

  // Clean up test data
  const tempDir = path.join(__dirname, '../../..', 'test-temp');
  try {
    console.log('테스트 데이터 디렉토리 정리 중...');
    await fs.remove(tempDir);
  } catch (error) {
    console.error('Failed to remove test directory:', error);
  }

  // Reset test environment variables
  delete process.env.MCP_CONTEXT_DIR;
  delete process.env.MCP_USE_VECTOR_DB;
  delete process.env.MCP_USE_GRAPH_DB;

  console.log('테스트 환경 정리 완료');

  // 짧은 대기 시간 추가하여 모든 비동기 작업이 완료되도록 함
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * Helper function to simulate add_context tool calls
 */
async function addContext(
  contextId: string,
  message: string,
  role: 'user' | 'assistant',
  importance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM',
  tags: string[] = []
): Promise<void> {
  if (!testServices?.mcpServer) {
    throw new Error('MCP server not initialized');
  }

  const addContextTool = testServices.mcpServer.tools.find(
    (tool) => tool.getName() === TOOL_NAMES.ADD_CONTEXT
  );

  if (!addContextTool) {
    throw new Error(`${TOOL_NAMES.ADD_CONTEXT} tool not found`);
  }

  const handler = addContextTool.getHandler(testServices.mcpServer);

  const params: AddContextParams = {
    random_string: 'test-random-string',
    contextId,
    message,
    role,
    importance,
    tags,
  };

  await handler(params);
  console.log(`✓ Added ${role} message to context: ${contextId}`);
}

/**
 * Helper function to simulate get_context tool calls
 */
async function getContext(contextId: string): Promise<Record<string, unknown>> {
  if (!testServices?.mcpServer) {
    throw new Error('MCP server not initialized');
  }

  const getContextTool = testServices.mcpServer.tools.find(
    (tool) => tool.getName() === TOOL_NAMES.GET_CONTEXT
  );

  if (!getContextTool) {
    throw new Error(`${TOOL_NAMES.GET_CONTEXT} tool not found`);
  }

  const handler = getContextTool.getHandler(testServices.mcpServer);

  const params: GetContextParams = {
    random_string: 'test-random-string',
    contextId,
  };

  const result = (await handler(params)) as { content: Array<{ text: string }>; isError: boolean };
  const parsedResult = JSON.parse(result.content[0].text);

  if (!parsedResult.success) {
    throw new Error(`Failed to get context: ${parsedResult.error}`);
  }

  const context = parsedResult.result;
  console.log(`✓ Retrieved context: ${contextId} (${context.messages.length} messages)`);
  return context;
}

/**
 * Helper function to simulate get_context with query
 */
async function searchSimilarContexts(
  query: string,
  limit: number = 5
): Promise<Array<Record<string, unknown>>> {
  if (!testServices?.mcpServer) {
    throw new Error('MCP server not initialized');
  }

  const getContextTool = testServices.mcpServer.tools.find(
    (tool) => tool.getName() === TOOL_NAMES.GET_CONTEXT
  );

  if (!getContextTool) {
    throw new Error(`${TOOL_NAMES.GET_CONTEXT} tool not found`);
  }

  const handler = getContextTool.getHandler(testServices.mcpServer);

  const params: GetContextParams = {
    random_string: 'test-random-string',
    query,
    limit,
  };

  const result = (await handler(params)) as { content: Array<{ text: string }>; isError: boolean };
  const parsedResult = JSON.parse(result.content[0].text);

  if (!parsedResult.success) {
    throw new Error(`Failed to search contexts: ${parsedResult.error}`);
  }

  const similarContexts = parsedResult.result;
  console.log(
    `✓ Found ${similarContexts.length} similar contexts for query: "${query.substring(0, 30)}..."`
  );

  return similarContexts;
}

export async function runComplexDevelopmentScenario() {
  // Initialize test environment
  try {
    const services = await setupTestEnvironment();
    testServices = services;

    console.log('\n=== Complex Development Scenario Integration Test ===\n');

    // Phase 1: System Architecture Discussion
    console.log('Phase 1: System Architecture Discussion');

    // Use add_context to create a new context
    await addContext(
      'system-architecture',
      `# Microservice Architecture Overview
      
      Our system uses a microservice architecture with the following components:
      
      1. **API Gateway**: Entry point for all client requests, handles authentication and request routing.
      2. **User Service**: Manages user accounts, profiles, and authentication.
      3. **Content Service**: Handles content creation, storage, and retrieval.
      4. **Analytics Service**: Collects and processes user interaction data.
      5. **Notification Service**: Manages push notifications and email alerts.
      
      Each service communicates via REST APIs and message queues. Services are containerized using Docker and orchestrated with Kubernetes.
      
      The data storage strategy varies by service:
      - User Service: PostgreSQL for relational data
      - Content Service: MongoDB for content and metadata
      - Analytics Service: ClickHouse for time-series data
      - Notification Service: Redis for queues and temporary storage
      
      This architecture allows teams to work independently and deploy services separately, improving development velocity and system resilience.`,
      'user',
      'HIGH',
      ['architecture', 'microservices']
    );

    // Phase 2: Code Implementation Discussions
    console.log('\nPhase 2: Code Implementation Discussions');

    // Add API Gateway implementation details
    await addContext(
      'api-gateway-implementation',
      `# API Gateway Implementation
      
      We've implemented the API Gateway using Node.js with Express. Here's the core routing logic:
      
      \`\`\`javascript
      const express = require('express');
      const { authenticate } = require('./auth');
      const { createProxyMiddleware } = require('http-proxy-middleware');
      
      const app = express();
      
      // Authentication middleware
      app.use(authenticate);
      
      // Service routing
      app.use('/api/users', createProxyMiddleware({ 
        target: 'http://user-service:3001',
        pathRewrite: {'^/api/users': ''},
        changeOrigin: true 
      }));
      
      app.use('/api/content', createProxyMiddleware({ 
        target: 'http://content-service:3002',
        pathRewrite: {'^/api/content': ''},
        changeOrigin: true 
      }));
      
      app.use('/api/analytics', createProxyMiddleware({ 
        target: 'http://analytics-service:3003',
        pathRewrite: {'^/api/analytics': ''},
        changeOrigin: true 
      }));
      
      app.use('/api/notifications', createProxyMiddleware({ 
        target: 'http://notification-service:3004',
        pathRewrite: {'^/api/notifications': ''},
        changeOrigin: true 
      }));
      
      // Error handling
      app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).json({ error: 'Internal Server Error' });
      });
      
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        console.log(\`API Gateway running on port \${PORT}\`);
      });
      \`\`\`
      
      The gateway handles cross-cutting concerns like:
      1. Authentication and authorization
      2. Request logging
      3. Rate limiting
      4. CORS configuration
      5. Response caching`,
      'user',
      'HIGH',
      ['api-gateway', 'nodejs', 'code']
    );

    // Add response from assistant
    await addContext(
      'api-gateway-implementation',
      `Thanks for sharing the API Gateway implementation. Looking at your code, I notice a few potential areas for improvement:

      1. You might want to add request timeout handling for each proxy
      2. Consider adding health check endpoints for each service
      3. The error handling could be more granular based on different error types
      
      Would you like me to suggest specific code changes for any of these?`,
      'assistant',
      'MEDIUM',
      ['feedback', 'code-review']
    );

    // Phase 3: User Service Implementation
    console.log('\nPhase 3: User Service Implementation');

    await addContext(
      'user-service-implementation',
      `Here's the core of our User Service implementation using TypeScript:

      \`\`\`typescript
      import express, { Request, Response, NextFunction } from 'express';
      import bcrypt from 'bcrypt';
      import jwt from 'jsonwebtoken';
      import { Pool } from 'pg';
      
      // Database connection
      const pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
      });
      
      const app = express();
      app.use(express.json());
      
      // User registration
      app.post('/register', async (req: Request, res: Response) => {
        try {
          const { username, email, password } = req.body;
          
          // Validate input
          if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
          }
          
          // Check if user exists
          const userCheck = await pool.query(
            'SELECT * FROM users WHERE email = $1', [email]
          );
          
          if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
          }
          
          // Hash password
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(password, salt);
          
          // Insert user
          const result = await pool.query(
            'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
            [username, email, hashedPassword]
          );
          
          res.status(201).json(result.rows[0]);
        } catch (err) {
          console.error('Registration error:', err);
          res.status(500).json({ error: 'Server error' });
        }
      });
      
      // User login
      app.post('/login', async (req: Request, res: Response) => {
        try {
          const { email, password } = req.body;
          
          // Validate input
          if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
          }
          
          // Find user
          const result = await pool.query(
            'SELECT * FROM users WHERE email = $1', [email]
          );
          
          if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
          }
          
          const user = result.rows[0];
          
          // Verify password
          const isMatch = await bcrypt.compare(password, user.password);
          
          if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
          }
          
          // Generate JWT
          const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || 'default_secret',
            { expiresIn: '1d' }
          );
          
          res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
        } catch (err) {
          console.error('Login error:', err);
          res.status(500).json({ error: 'Server error' });
        }
      });
      
      // Protected route example
      app.get('/profile', authenticateToken, async (req: Request, res: Response) => {
        try {
          const userId = req.user.id;
          
          const result = await pool.query(
            'SELECT id, username, email, created_at FROM users WHERE id = $1',
            [userId]
          );
          
          if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
          }
          
          res.json(result.rows[0]);
        } catch (err) {
          console.error('Profile error:', err);
          res.status(500).json({ error: 'Server error' });
        }
      });
      
      // Authentication middleware
      function authenticateToken(req: Request, res: Response, next: NextFunction) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        
        jwt.verify(token, process.env.JWT_SECRET || 'default_secret', (err: any, user: any) => {
          if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
          }
          
          req.user = user;
          next();
        });
      }
      
      // Start server
      const PORT = process.env.PORT || 3001;
      app.listen(PORT, () => {
        console.log(\`User service running on port \${PORT}\`);
      });
      \`\`\`
      
      This covers basic user registration, authentication, and profile retrieval. We're using PostgreSQL for storing user data, bcrypt for password hashing, and JWT for authentication tokens.`,
      'user',
      'HIGH',
      ['user-service', 'typescript', 'code']
    );

    // Phase 4: Testing Context Retrieval
    console.log('\nPhase 4: Testing Context Retrieval');

    // Retrieve a specific context
    const apiGatewayContext = await getContext('api-gateway-implementation');
    console.log(
      `Retrieved API Gateway context with ${(apiGatewayContext as { messages: unknown[] }).messages.length} messages`
    );

    // Use the search functionality to find similar contexts
    const similarContexts = await searchSimilarContexts(
      'microservice architecture design patterns',
      3
    );
    console.log('Similar contexts found:');
    for (const context of similarContexts) {
      console.log(
        `- ${context.contextId} (similarity: ${(context.similarity as number)?.toFixed(2) || 'N/A'})`
      );
    }

    // Test context search with code query
    const codeContexts = await searchSimilarContexts('express nodejs authentication middleware', 3);
    console.log('Code-related contexts found:');
    for (const context of codeContexts) {
      console.log(
        `- ${context.contextId} (similarity: ${(context.similarity as number)?.toFixed(2) || 'N/A'})`
      );
    }

    console.log('\n=== Test completed successfully ===\n');
  } catch (error) {
    console.error('Test failed with error:', error);
    throw error;
  } finally {
    await cleanupTestEnvironment();
  }
}

// Export the function for direct execution if needed
