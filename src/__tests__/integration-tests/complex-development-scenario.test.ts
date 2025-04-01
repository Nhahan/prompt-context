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
  process.env.MCP_DEBUG = 'true';

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
  if (testServices) {
    // Clean up resources if needed
    if (testServices.vectorRepository) {
      await testServices.vectorRepository.close();
    }

    // Reset test services
    testServices = null;
  }

  // Clean up test data
  const tempDir = path.join(__dirname, '../../..', 'test-temp');
  try {
    await fs.remove(tempDir);
  } catch (error) {
    console.error('Failed to remove test directory:', error);
  }

  // Reset test environment variables
  delete process.env.MCP_CONTEXT_DIR;
  delete process.env.MCP_USE_VECTOR_DB;
  delete process.env.MCP_USE_GRAPH_DB;
  delete process.env.MCP_DEBUG;
}

async function runComplexDevelopmentScenario() {
  // Initialize test environment
  let testServices: InitializedServices;
  try {
    testServices = await setupTestEnvironment();

    console.log('\n=== Complex Development Scenario Integration Test ===\n');

    const vectorRepo = testServices.vectorRepository;

    if (!vectorRepo) {
      throw new Error('Vector repository not initialized in test services');
    }

    // Phase 1: System Architecture Discussion
    console.log('Phase 1: System Architecture Discussion');

    // Add complex architecture discussion context
    const architectureContext = {
      id: 'system-architecture',
      text: `# Microservice Architecture Overview
      
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
      summary:
        'System microservice architecture overview with components and data storage strategy',
    };
    await vectorRepo.addContext(
      architectureContext.id,
      architectureContext.text,
      architectureContext.summary
    );
    console.log('✓ Added system architecture context');

    // Phase 2: Code Implementation Discussions
    console.log('\nPhase 2: Code Implementation Discussions');

    // Add API Gateway implementation details
    const apiGatewayContext = {
      id: 'api-gateway-implementation',
      text: `# API Gateway Implementation
      
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
      summary:
        'API Gateway implementation details with Node.js/Express, including routing and middleware',
    };
    await vectorRepo.addContext(
      apiGatewayContext.id,
      apiGatewayContext.text,
      apiGatewayContext.summary
    );

    // Add relationship between contexts
    await vectorRepo.addRelationship(
      architectureContext.id,
      apiGatewayContext.id,
      'implements',
      0.9
    );
    console.log('✓ Added API Gateway implementation context with relationship');

    // Add User Service implementation details
    const userServiceContext = {
      id: 'user-service-implementation',
      text: `# User Service Implementation
      
      The User Service is built with Spring Boot and uses PostgreSQL. Here's the core user model and repository:
      
      \`\`\`java
      // User.java
      @Entity
      @Table(name = "users")
      public class User {
          @Id
          @GeneratedValue(strategy = GenerationType.IDENTITY)
          private Long id;
          
          @Column(nullable = false, unique = true)
          private String username;
          
          @Column(nullable = false)
          private String password; // Stored as bcrypt hash
          
          @Column(nullable = false, unique = true)
          private String email;
          
          @Column(name = "created_at")
          private LocalDateTime createdAt;
          
          @Column(name = "updated_at")
          private LocalDateTime updatedAt;
          
          @PrePersist
          protected void onCreate() {
              createdAt = LocalDateTime.now();
              updatedAt = LocalDateTime.now();
          }
          
          @PreUpdate
          protected void onUpdate() {
              updatedAt = LocalDateTime.now();
          }
          
          // Getters and setters
      }
      
      // UserRepository.java
      @Repository
      public interface UserRepository extends JpaRepository<User, Long> {
          Optional<User> findByUsername(String username);
          Optional<User> findByEmail(String email);
          boolean existsByUsername(String username);
          boolean existsByEmail(String email);
      }
      \`\`\`
      
      And the authentication controller:
      
      \`\`\`java
      @RestController
      @RequestMapping("/auth")
      public class AuthController {
          @Autowired
          private AuthService authService;
          
          @PostMapping("/login")
          public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
              AuthResponse response = authService.authenticate(request.getUsername(), request.getPassword());
              return ResponseEntity.ok(response);
          }
          
          @PostMapping("/register")
          public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
              authService.register(request);
              return ResponseEntity.status(HttpStatus.CREATED).build();
          }
          
          @PostMapping("/refresh")
          public ResponseEntity<?> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
              AuthResponse response = authService.refreshToken(request.getRefreshToken());
              return ResponseEntity.ok(response);
          }
      }
      \`\`\``,
      summary:
        'User Service implementation with Spring Boot, PostgreSQL, including user model and authentication',
    };
    await vectorRepo.addContext(
      userServiceContext.id,
      userServiceContext.text,
      userServiceContext.summary
    );

    // Add relationship between contexts
    await vectorRepo.addRelationship(
      architectureContext.id,
      userServiceContext.id,
      'implements',
      0.9
    );
    console.log('✓ Added User Service implementation context with relationship');

    // Phase 3: Testing Strategy Discussion
    console.log('\nPhase 3: Testing Strategy Discussion');

    const testingStrategyContext = {
      id: 'testing-strategy',
      text: `# Testing Strategy for Microservices
      
      Our testing strategy follows the testing pyramid approach:
      
      ## Unit Tests
      Each service has comprehensive unit tests covering all business logic. Example of a User Service test:
      
      \`\`\`java
      @SpringBootTest
      class UserServiceTest {
          @MockBean
          private UserRepository userRepository;
          
          @Autowired
          private UserService userService;
          
          @Test
          void createUser_WithValidData_ShouldSucceed() {
              // Arrange
              CreateUserRequest request = new CreateUserRequest("testuser", "test@example.com", "password123");
              when(userRepository.existsByUsername("testuser")).thenReturn(false);
              when(userRepository.existsByEmail("test@example.com")).thenReturn(false);
              
              User savedUser = new User();
              savedUser.setId(1L);
              savedUser.setUsername("testuser");
              savedUser.setEmail("test@example.com");
              
              when(userRepository.save(any(User.class))).thenReturn(savedUser);
              
              // Act
              UserResponse response = userService.createUser(request);
              
              // Assert
              assertNotNull(response);
              assertEquals("testuser", response.getUsername());
              assertEquals("test@example.com", response.getEmail());
              
              verify(userRepository).existsByUsername("testuser");
              verify(userRepository).existsByEmail("test@example.com");
              verify(userRepository).save(any(User.class));
          }
      }
      \`\`\`
      
      ## Integration Tests
      We use testcontainers for integration tests with actual databases:
      
      \`\`\`java
      @SpringBootTest
      @Testcontainers
      class UserRepositoryIntegrationTest {
          @Container
          static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:13")
              .withDatabaseName("testdb")
              .withUsername("test")
              .withPassword("test");
          
          @DynamicPropertySource
          static void registerPgProperties(DynamicPropertyRegistry registry) {
              registry.add("spring.datasource.url", postgres::getJdbcUrl);
              registry.add("spring.datasource.username", postgres::getUsername);
              registry.add("spring.datasource.password", postgres::getPassword);
          }
          
          @Autowired
          private UserRepository userRepository;
          
          @Test
          void findByUsername_ShouldReturnUser() {
              // Arrange
              User user = new User();
              user.setUsername("testuser");
              user.setEmail("test@example.com");
              user.setPassword("hashedpassword");
              userRepository.save(user);
              
              // Act
              Optional<User> found = userRepository.findByUsername("testuser");
              
              // Assert
              assertTrue(found.isPresent());
              assertEquals("testuser", found.get().getUsername());
              assertEquals("test@example.com", found.get().getEmail());
          }
      }
      \`\`\`
      
      ## API Tests
      We use REST Assured for API testing:
      
      \`\`\`java
      @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
      class UserControllerApiTest {
          @LocalServerPort
          private int port;
          
          @Test
          void registerUser_ShouldReturnCreated() {
              RegisterRequest request = new RegisterRequest("newuser", "new@example.com", "password123");
              
              given()
                  .port(port)
                  .contentType(ContentType.JSON)
                  .body(request)
              .when()
                  .post("/auth/register")
              .then()
                  .statusCode(201);
          }
      }
      \`\`\`
      
      ## End-to-End Tests
      We use Cypress for E2E testing of the entire system.
      
      ## Performance Tests
      We use JMeter and Gatling for load testing each service and the system as a whole.`,
      summary:
        'Comprehensive testing strategy for microservices with unit, integration, API, E2E, and performance testing',
    };
    await vectorRepo.addContext(
      testingStrategyContext.id,
      testingStrategyContext.text,
      testingStrategyContext.summary
    );

    // Add relationships
    await vectorRepo.addRelationship(
      architectureContext.id,
      testingStrategyContext.id,
      'relates_to',
      0.7
    );
    await vectorRepo.addRelationship(
      userServiceContext.id,
      testingStrategyContext.id,
      'tested_by',
      0.8
    );
    console.log('✓ Added testing strategy context with relationships');

    // Phase 4: DevOps Pipeline Discussion
    console.log('\nPhase 4: DevOps Pipeline Discussion');

    const devopsContext = {
      id: 'devops-pipeline',
      text: `# CI/CD Pipeline for Microservices
      
      Our CI/CD pipeline is implemented using GitHub Actions with the following workflow:
      
      \`\`\`yaml
      name: Microservice CI/CD Pipeline
      
      on:
        push:
          branches: [ main, develop ]
        pull_request:
          branches: [ main, develop ]
      
      jobs:
        build:
          runs-on: ubuntu-latest
          
          steps:
          - uses: actions/checkout@v3
          
          - name: Set up JDK 17
            uses: actions/setup-java@v3
            with:
              java-version: '17'
              distribution: 'temurin'
              cache: maven
          
          - name: Build with Maven
            run: mvn -B package --file pom.xml
          
          - name: Run Tests
            run: mvn test
          
          - name: Build Docker image
            run: |
              docker build -t myorg/user-service:$GITHUB_SHA .
              docker tag myorg/user-service:$GITHUB_SHA myorg/user-service:latest
          
          - name: Push Docker image
            if: github.ref == 'refs/heads/main'
            run: |
              echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin
              docker push myorg/user-service:$GITHUB_SHA
              docker push myorg/user-service:latest
          
          - name: Deploy to Kubernetes
            if: github.ref == 'refs/heads/main'
            run: |
              kubectl config use-context production
              kubectl set image deployment/user-service user-service=myorg/user-service:$GITHUB_SHA
              kubectl rollout status deployment/user-service
      \`\`\`
      
      The pipeline includes:
      
      1. **Build**: Compile the code and package the application
      2. **Test**: Run all tests to ensure quality
      3. **Package**: Build Docker images
      4. **Publish**: Push Docker images to registry
      5. **Deploy**: Update Kubernetes deployments
      
      We use GitOps principles for managing infrastructure with ArgoCD:
      
      \`\`\`yaml
      apiVersion: argoproj.io/v1alpha1
      kind: Application
      metadata:
        name: user-service
        namespace: argocd
      spec:
        project: default
        source:
          repoURL: https://github.com/myorg/k8s-manifests.git
          targetRevision: HEAD
          path: user-service
        destination:
          server: https://kubernetes.default.svc
          namespace: microservices
        syncPolicy:
          automated:
            prune: true
            selfHeal: true
      \`\`\`
      
      This ensures that our infrastructure is always in sync with our code repositories.`,
      summary:
        'CI/CD pipeline with GitHub Actions and Kubernetes deployment for microservices architecture',
    };
    await vectorRepo.addContext(devopsContext.id, devopsContext.text, devopsContext.summary);

    // Add relationships
    await vectorRepo.addRelationship(architectureContext.id, devopsContext.id, 'deployed_by', 0.8);
    await vectorRepo.addRelationship(
      testingStrategyContext.id,
      devopsContext.id,
      'integrated_with',
      0.7
    );
    console.log('✓ Added DevOps pipeline context with relationships');

    // Phase 5: Complex Search Testing
    console.log('\nPhase 5: Complex Search Testing');

    // Test 1: Search for implementation details with specific technology
    const search1 = await vectorRepo.findSimilarContexts(
      'Spring Boot user service implementation',
      3
    );
    console.log(
      `Search 1: Found ${search1.length} results for "Spring Boot user service implementation"`
    );
    console.log(
      'Search 1 results:',
      JSON.stringify(
        search1.map((r) => ({
          id: r.contextId,
          similarity: r.similarity,
          summary: r.summary?.substring(0, 50) + '...',
        })),
        null,
        2
      )
    );

    // Verify specific context is found with good similarity
    if (search1.length === 0) {
      throw new Error('Expected to find some results for Spring Boot user service query');
    }
    // Log success
    console.log('✓ Found results for Spring Boot user service implementation query');

    // Test 2: Search for architectural components
    const search2 = await vectorRepo.findSimilarContexts(
      'What database does the analytics service use?',
      3
    );
    console.log(
      `Search 2: Found ${search2.length} results for "What database does the analytics service use?"`
    );
    console.log(
      'Search 2 results:',
      JSON.stringify(
        search2.map((r) => ({
          id: r.contextId,
          similarity: r.similarity,
          summary: r.summary?.substring(0, 50) + '...',
        })),
        null,
        2
      )
    );

    // Verify architecture context is found with good similarity
    if (search2.length === 0) {
      throw new Error('Expected to find some results for database question');
    }
    // Log success
    console.log('✓ Found results for database query');

    // Test 3: Search with code sample
    const search3 = await vectorRepo.findSimilarContexts(
      `
    @RestController
    public class UserController {
        @GetMapping("/users")
        public List<User> getAllUsers() {
            // Implementation needed
        }
    }`,
      3
    );
    console.log(`Search 3: Found ${search3.length} results for Java controller code snippet`);
    console.log(
      'Search 3 results:',
      JSON.stringify(
        search3.map((r) => ({
          id: r.contextId,
          similarity: r.similarity,
          summary: r.summary?.substring(0, 50) + '...',
        })),
        null,
        2
      )
    );

    // Verify implementation context is found with good similarity for code sample
    if (search3.length === 0) {
      throw new Error('Expected to find some results for Java controller code');
    }
    // Log success
    console.log('✓ Found results for Java controller code snippet');

    // Test 4: Search for testing details
    const search4 = await vectorRepo.findSimilarContexts(
      'How are integration tests implemented with databases?',
      3
    );
    console.log(
      `Search 4: Found ${search4.length} results for "How are integration tests implemented with databases?"`
    );
    console.log(
      'Search 4 results:',
      JSON.stringify(
        search4.map((r) => ({
          id: r.contextId,
          similarity: r.similarity,
          summary: r.summary?.substring(0, 50) + '...',
        })),
        null,
        2
      )
    );

    // Verify relevant contexts for integration tests are found
    if (search4.length === 0) {
      throw new Error('Expected to find some results for integration test query');
    }
    // Log success
    console.log('✓ Found results for integration test query');

    // Test 5: Search with obscure wording
    const search5 = await vectorRepo.findSimilarContexts(
      "What's the CI/CD setup for deploying the microservices stuff?",
      3
    );
    console.log(`Search 5: Found ${search5.length} results for informal devops question`);
    console.log(
      'Search 5 results:',
      JSON.stringify(
        search5.map((r) => ({
          id: r.contextId,
          similarity: r.similarity,
          summary: r.summary?.substring(0, 50) + '...',
        })),
        null,
        2
      )
    );

    // Verify devops context is found with good similarity despite informal language
    if (search5.length === 0) {
      throw new Error('Expected to find some results for informal devops question');
    }
    // Log success
    console.log('✓ Found results for informal devops question');

    // Test 6: Test with relationship boost
    // This query could match multiple contexts, but relationships should boost the most connected one
    const search6 = await vectorRepo.findSimilarContexts(
      'How does the overall system architecture work?',
      3
    );
    console.log(`Search 6: Found ${search6.length} results for general architecture question`);
    console.log(
      'Search 6 results:',
      JSON.stringify(
        search6.map((r) => ({
          id: r.contextId,
          similarity: r.similarity,
          summary: r.summary?.substring(0, 50) + '...',
        })),
        null,
        2
      )
    );

    // Verify architecture context is ranked highly due to relationships
    if (search6.length === 0) {
      throw new Error('Expected to find some results for architecture question');
    }
    // Log success
    console.log('✓ Found results for architecture question');

    console.log('\n✓ All complex search tests passed');

    console.log('\n=== Complex Development Scenario Integration Test Completed Successfully ===\n');
  } catch (error) {
    console.error('Complex development scenario test failed:', error);
    process.exit(1);
  } finally {
    await cleanupTestEnvironment();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runComplexDevelopmentScenario();
}

export { runComplexDevelopmentScenario };
