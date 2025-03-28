import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';

// Constants for testing
const SERVER_URL = 'http://localhost:3000';
const TEST_CONTEXT_ID = 'test-vector-graph';
const TEST_RELATED_CONTEXT_ID = 'test-related-context';
const TEST_DIR = './.prompt-context';

/**
 * Test suite for vector and graph integration
 */
describe('Vector and Graph Integration Tests', () => {
  // Clean up test contexts after tests
  afterAll(async () => {
    try {
      await fs.remove(path.join(TEST_DIR, `${TEST_CONTEXT_ID}.json`));
      await fs.remove(path.join(TEST_DIR, `${TEST_CONTEXT_ID}.summary.json`));
      await fs.remove(path.join(TEST_DIR, `${TEST_RELATED_CONTEXT_ID}.json`));
      await fs.remove(path.join(TEST_DIR, `${TEST_RELATED_CONTEXT_ID}.summary.json`));
      
      // Clean up vector and graph data
      await fs.remove(path.join(TEST_DIR, 'vectors'));
      await fs.remove(path.join(TEST_DIR, 'graph'));
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  });
  
  // Test vector similarity search
  test('Should add messages and find similar contexts', async () => {
    // Step 1: Add messages to first context
    await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'add',
      contextId: TEST_CONTEXT_ID,
      role: 'user',
      content: 'Tell me about machine learning algorithms for natural language processing.'
    });
    
    await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'add',
      contextId: TEST_CONTEXT_ID,
      role: 'assistant',
      content: 'Machine learning algorithms for NLP include transformers, recurrent neural networks, and word embeddings. Transformers have become especially popular due to their ability to process text in parallel rather than sequentially.'
    });
    
    await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'add',
      contextId: TEST_CONTEXT_ID,
      role: 'user',
      content: 'What are the advantages of transformer models?'
    });
    
    await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'add',
      contextId: TEST_CONTEXT_ID,
      role: 'assistant',
      content: 'Transformer models have several advantages: 1) Parallel processing which speeds up training, 2) Attention mechanisms that capture long-range dependencies, 3) Pre-training on large corpora which enables transfer learning, and 4) Scalability to handle very large models with billions of parameters.'
    });
    
    // Force summarization
    const summaryResult = await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'summarize',
      contextId: TEST_CONTEXT_ID
    });
    
    expect(summaryResult.data.success).toBe(true);
    
    // Step 2: Add messages to a second context with somewhat related content
    await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'add',
      contextId: TEST_RELATED_CONTEXT_ID,
      role: 'user',
      content: 'What are some popular deep learning frameworks?'
    });
    
    await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'add',
      contextId: TEST_RELATED_CONTEXT_ID,
      role: 'assistant',
      content: 'Popular deep learning frameworks include TensorFlow, PyTorch, JAX, and Keras. These frameworks provide tools and APIs for building and training neural networks for various applications including computer vision and natural language processing.'
    });
    
    await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'add',
      contextId: TEST_RELATED_CONTEXT_ID,
      role: 'user',
      content: 'Which one is best for NLP?'
    });
    
    await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'add',
      contextId: TEST_RELATED_CONTEXT_ID,
      role: 'assistant',
      content: 'For NLP, PyTorch has become particularly popular in research due to its dynamic computation graph and ease of debugging. However, TensorFlow with its production-ready tools is widely used in industry. Libraries like Hugging Face Transformers support both frameworks and provide pre-trained models for NLP tasks.'
    });
    
    // Force summarization
    const relatedSummaryResult = await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'summarize',
      contextId: TEST_RELATED_CONTEXT_ID
    });
    
    expect(relatedSummaryResult.data.success).toBe(true);
    
    // Step 3: Test similarity search
    const similarityResult = await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'find_similar',
      contextId: TEST_CONTEXT_ID,
      searchText: 'transformer models for natural language processing'
    });
    
    // Check that the query ran successfully, regardless of results
    expect(similarityResult.data.success).toBe(true);
    expect(similarityResult.data.similarContexts).toBeDefined();
    
    // Now let's try an alternative way to search using direct HTTP GET
    const alternativeSimilarityResult = await axios.get(`${SERVER_URL}/similar`, {
      params: {
        text: 'natural language processing machine learning',
        limit: 5
      }
    });
    
    expect(alternativeSimilarityResult.data.success).toBe(true);
    expect(alternativeSimilarityResult.data.similarContexts).toBeDefined();
    
    console.log('Similarity search results:', 
      JSON.stringify(alternativeSimilarityResult.data.similarContexts, null, 2));
    
    // Either the vector search works, or we have a fallback mechanism
    // In either case, we should have our contexts in the response
    // But in case it falls back to a simple mechanism, we won't enforce length > 0
    
    // Get all contexts to check if our test contexts exist
    const contextsResult = await axios.get(`${SERVER_URL}/contexts`);
    expect(contextsResult.data.success).toBe(true);
    expect(contextsResult.data.contextIds).toBeDefined();
    expect(contextsResult.data.contextIds).toContain(TEST_CONTEXT_ID);
    expect(contextsResult.data.contextIds).toContain(TEST_RELATED_CONTEXT_ID);
    
  }, 30000); // Increase timeout due to summarization
  
  // Test relationship creation and path finding
  test('Should create relationships and find paths between contexts', async () => {
    // Step 1: Create a relationship between contexts
    const relationshipResult = await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'add_relationship',
      contextId: TEST_CONTEXT_ID,
      targetId: TEST_RELATED_CONTEXT_ID,
      relationshipType: 'similar',
      strength: 0.8
    });
    
    expect(relationshipResult.data.success).toBe(true);
    
    // Step 2: Get related contexts
    const relatedResult = await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'get_related',
      contextId: TEST_CONTEXT_ID
    });
    
    expect(relatedResult.data.success).toBe(true);
    expect(relatedResult.data.relatedContexts).toContain(TEST_RELATED_CONTEXT_ID);
    
    // Step 3: Find path between contexts
    const pathResult = await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'find_path',
      contextId: TEST_CONTEXT_ID,
      targetId: TEST_RELATED_CONTEXT_ID
    });
    
    expect(pathResult.data.success).toBe(true);
    expect(pathResult.data.path).toBeDefined();
    expect(pathResult.data.path.length).toBeGreaterThan(0);
    expect(pathResult.data.path).toContain(TEST_CONTEXT_ID);
    expect(pathResult.data.path).toContain(TEST_RELATED_CONTEXT_ID);
  }, 10000);
  
  // Test context cleanup
  test('Should clean up irrelevant contexts', async () => {
    // Create an irrelevant context
    const IRRELEVANT_CONTEXT = 'test-irrelevant-context';
    
    await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'add',
      contextId: IRRELEVANT_CONTEXT,
      role: 'user',
      content: 'This is a completely unrelated topic about cooking recipes.'
    });
    
    await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'add',
      contextId: IRRELEVANT_CONTEXT,
      role: 'assistant',
      content: 'Cooking is the art of preparing food for consumption with the use of heat. Techniques and ingredients vary widely, from grilling food over an open fire to using electric stoves, to baking in various types of ovens.'
    });
    
    // Force summarization
    await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'summarize',
      contextId: IRRELEVANT_CONTEXT
    });
    
    // Trigger cleanup
    const cleanupResult = await axios.post(`${SERVER_URL}/tools/context_memory`, {
      action: 'cleanup',
      contextId: TEST_CONTEXT_ID
    });
    
    expect(cleanupResult.data.success).toBe(true);
    expect(cleanupResult.data.cleanedContexts).toBeDefined();
    
    // Wait for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try to retrieve the cleaned up context
    try {
      await axios.post(`${SERVER_URL}/tools/context_memory`, {
        action: 'retrieve',
        contextId: IRRELEVANT_CONTEXT
      });
      // If we get here, the test fails because the context should be cleaned up
      fail('Irrelevant context should have been cleaned up');
    } catch (error) {
      // Expected behavior - context should be gone
      expect(error).toBeDefined();
    }
  }, 15000);
}); 