import { VectorRepository } from '../../repositories/vector.repository';
import path from 'path';
import { promises as fs } from 'fs';
import { setupTestEnvironment, cleanupTestEnvironment } from './setup';

/**
 * React AI Development Scenario Integration Test
 *
 * This test simulates a real-world React application development scenario with AI guidance:
 * - Step-by-step React app development through AI conversation
 * - Frontend component development including code examples
 * - State management implementation
 * - API integration discussion
 * - Testing strategy
 * - Handling user feedback and iterative development
 */
async function runReactAIDevelopmentScenario() {
  // Initialize test environment
  await setupTestEnvironment();

  const testDbPath = path.join(__dirname, '../temp/react-ai-dev-scenario.json');
  let vectorRepo: VectorRepository | undefined;

  try {
    console.log('\n=== React AI Development Scenario Integration Test ===\n');

    // Initialize repository
    vectorRepo = new VectorRepository(testDbPath);
    await vectorRepo.ensureInitialized();

    // Phase 1: Initial Project Setup and Requirements
    console.log('Phase 1: Initial Project Setup and Requirements Discussion');

    // Add project requirements discussion
    const projectRequirements = {
      id: 'project-requirements',
      text: `# React Todo App Requirements

      We need to build a React-based Todo application with the following features:
      
      1. **Task Management**:
         - Create, read, update, and delete tasks
         - Mark tasks as complete/incomplete
         - Filter tasks by status (All, Active, Completed)
      
      2. **User Experience**:
         - Clean, intuitive UI with responsive design
         - Drag-and-drop for reordering tasks
         - Animations for better feedback
      
      3. **Data Management**:
         - Local storage persistence
         - Optional: Backend integration with REST API
      
      4. **Technical Requirements**:
         - React 18 with functional components and hooks
         - TypeScript for type safety
         - Styled Components for styling
         - React Testing Library for tests
      
      The app should be performant, accessible, and maintainable with clear component structure.`,
      summary:
        'Requirements for a React Todo application with task management, UX features, and technical specifications',
    };
    await vectorRepo.addContext(
      projectRequirements.id,
      projectRequirements.text,
      projectRequirements.summary
    );
    console.log('✓ Added project requirements context');

    // Phase 2: Component Structure Discussion
    console.log('\nPhase 2: Component Structure Discussion');

    // Add component structure discussion
    const componentStructure = {
      id: 'component-structure',
      text: `# React Todo App Component Structure

      Based on our requirements, here's a proposed component structure:

      1. **App**: Root component managing global state and routes
      
      2. **Components**:
         - **TodoList**: Container for all todo items
         - **TodoItem**: Individual todo with completion toggle and actions
         - **TodoForm**: Form for creating/editing todos
         - **TodoFilter**: Filter controls (All, Active, Completed)
         - **Header**: App header with title and summary
         - **Footer**: App footer with info and links
      
      3. **Hooks**:
         - **useTodos**: Custom hook for todo CRUD operations
         - **useLocalStorage**: Hook for persisting data
         - **useDragDrop**: Hook for drag-and-drop functionality
      
      4. **Context**:
         - **TodoContext**: Global state management for todos
      
      5. **Types**:
         - **Todo**: Interface defining todo item structure
         - **TodoFilter**: Type for filter options
      
      This structure follows a clear separation of concerns and promotes reusability. Each component has a single responsibility and the custom hooks encapsulate complex logic.`,
      summary:
        'Component structure for the React Todo app including main components, hooks, context, and types',
    };
    await vectorRepo.addContext(
      componentStructure.id,
      componentStructure.text,
      componentStructure.summary
    );

    // Add relationship between contexts
    await vectorRepo.addRelationship(
      projectRequirements.id,
      componentStructure.id,
      'leads_to',
      0.9
    );
    console.log('✓ Added component structure context with relationship');

    // Phase 3: Implementation of Core Components
    console.log('\nPhase 3: Implementation of Core Components');

    // Add TodoItem component implementation
    const todoItemComponent = {
      id: 'todo-item-implementation',
      text: `# TodoItem Component Implementation

      Here's the implementation of the TodoItem component:

      \`\`\`tsx
      import { FC, useState } from 'react';
      import styled from 'styled-components';
      import { Todo } from '../types';

      interface TodoItemProps {
        todo: Todo;
        onToggle: (id: string) => void;
        onDelete: (id: string) => void;
        onEdit: (id: string, text: string) => void;
      }

      const TodoItem: FC<TodoItemProps> = ({ todo, onToggle, onDelete, onEdit }) => {
        const [isEditing, setIsEditing] = useState(false);
        const [editText, setEditText] = useState(todo.text);

        const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          onEdit(todo.id, editText);
          setIsEditing(false);
        };

        return (
          <TodoItemContainer data-testid="todo-item" completed={todo.completed}>
            {isEditing ? (
              <form onSubmit={handleSubmit}>
                <EditInput
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  autoFocus
                />
                <ButtonGroup>
                  <Button type="submit">Save</Button>
                  <Button type="button" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </ButtonGroup>
              </form>
            ) : (
              <>
                <Checkbox
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => onToggle(todo.id)}
                />
                <TodoText completed={todo.completed}>{todo.text}</TodoText>
                <ButtonGroup>
                  <Button onClick={() => setIsEditing(true)}>Edit</Button>
                  <Button onClick={() => onDelete(todo.id)}>Delete</Button>
                </ButtonGroup>
              </>
            )}
          </TodoItemContainer>
        );
      };

      const TodoItemContainer = styled.li<{ completed: boolean }>\`
        display: flex;
        align-items: center;
        padding: 12px 16px;
        margin: 8px 0;
        background-color: #fff;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        transition: opacity 0.3s ease;
        opacity: \${({ completed }) => (completed ? 0.6 : 1)};
      \`;

      const Checkbox = styled.input\`
        margin-right: 12px;
        height: 18px;
        width: 18px;
      \`;

      const TodoText = styled.span<{ completed: boolean }>\`
        flex: 1;
        text-decoration: \${({ completed }) => (completed ? 'line-through' : 'none')};
        color: \${({ completed }) => (completed ? '#888' : '#333')};
      \`;

      const ButtonGroup = styled.div\`
        display: flex;
        gap: 8px;
      \`;

      const Button = styled.button\`
        background-color: #f1f1f1;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        cursor: pointer;
        
        &:hover {
          background-color: #e1e1e1;
        }
      \`;

      const EditInput = styled.input\`
        flex: 1;
        padding: 8px;
        margin-right: 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
      \`;

      export default TodoItem;
      \`\`\`

      This component handles both viewing and editing modes for a todo item, with appropriate styling for each state. The component is fully typed with TypeScript and uses styled-components for styling.`,
      summary:
        'Implementation of the TodoItem component with view and edit modes, styling, and TypeScript types',
    };
    await vectorRepo.addContext(
      todoItemComponent.id,
      todoItemComponent.text,
      todoItemComponent.summary
    );

    // Add relationship to component structure
    await vectorRepo.addRelationship(
      componentStructure.id,
      todoItemComponent.id,
      'implements',
      0.9
    );
    console.log('✓ Added TodoItem component implementation with relationship');

    // Phase 4: State Management Implementation
    console.log('\nPhase 4: State Management Implementation');

    // Add context API implementation
    const stateManagement = {
      id: 'state-management',
      text: `# Todo App State Management with Context API

      Here's how we implement state management using React Context:

      \`\`\`tsx
      // types.ts
      export interface Todo {
        id: string;
        text: string;
        completed: boolean;
        createdAt: Date;
      }

      export type FilterType = 'all' | 'active' | 'completed';

      // TodoContext.tsx
      import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
      import { Todo, FilterType } from './types';

      interface TodoContextType {
        todos: Todo[];
        filter: FilterType;
        addTodo: (text: string) => void;
        toggleTodo: (id: string) => void;
        deleteTodo: (id: string) => void;
        editTodo: (id: string, text: string) => void;
        setFilter: (filter: FilterType) => void;
        filteredTodos: Todo[];
      }

      const TodoContext = createContext<TodoContextType | undefined>(undefined);

      export const TodoProvider = ({ children }: { children: ReactNode }) => {
        const [todos, setTodos] = useState<Todo[]>(() => {
          // Load from localStorage
          const saved = localStorage.getItem('todos');
          return saved ? JSON.parse(saved) : [];
        });
        
        const [filter, setFilter] = useState<FilterType>('all');

        // Save to localStorage whenever todos change
        useEffect(() => {
          localStorage.setItem('todos', JSON.stringify(todos));
        }, [todos]);

        // Create a new todo
        const addTodo = (text: string) => {
          setTodos([
            ...todos,
            {
              id: Date.now().toString(),
              text,
              completed: false,
              createdAt: new Date(),
            },
          ]);
        };

        // Toggle todo completion
        const toggleTodo = (id: string) => {
          setTodos(
            todos.map((todo) =>
              todo.id === id ? { ...todo, completed: !todo.completed } : todo
            )
          );
        };

        // Delete a todo
        const deleteTodo = (id: string) => {
          setTodos(todos.filter((todo) => todo.id !== id));
        };

        // Edit a todo
        const editTodo = (id: string, text: string) => {
          setTodos(
            todos.map((todo) => (todo.id === id ? { ...todo, text } : todo))
          );
        };

        // Filter todos based on current filter
        const filteredTodos = todos.filter((todo) => {
          if (filter === 'active') return !todo.completed;
          if (filter === 'completed') return todo.completed;
          return true; // 'all' filter
        });

        const value = {
          todos,
          filter,
          addTodo,
          toggleTodo,
          deleteTodo,
          editTodo,
          setFilter,
          filteredTodos,
        };

        return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>;
      };

      // Custom hook for accessing the todo context
      export const useTodoContext = () => {
        const context = useContext(TodoContext);
        if (context === undefined) {
          throw new Error('useTodoContext must be used within a TodoProvider');
        }
        return context;
      };
      \`\`\`

      This implementation:
      
      1. Defines clear types for our todos and filters
      2. Creates a React Context with all necessary state and actions
      3. Implements localStorage persistence
      4. Provides a custom hook for easy access to the context
      5. Ensures type safety throughout with TypeScript`,
      summary:
        'Implementation of state management using React Context API with localStorage persistence, filtering, and TypeScript types',
    };
    await vectorRepo.addContext(stateManagement.id, stateManagement.text, stateManagement.summary);

    // Add relationships
    await vectorRepo.addRelationship(componentStructure.id, stateManagement.id, 'implements', 0.85);
    await vectorRepo.addRelationship(todoItemComponent.id, stateManagement.id, 'uses', 0.8);
    console.log('✓ Added state management implementation with relationships');

    // Phase 5: Testing Strategy
    console.log('\nPhase 5: Testing Strategy');

    // Add testing strategy discussion
    const testingStrategy = {
      id: 'testing-strategy',
      text: `# Testing Strategy for React Todo App

      Here's our comprehensive testing approach for the Todo application:

      ## Unit Testing Components

      Using React Testing Library for component tests:

      \`\`\`tsx
      // TodoItem.test.tsx
      import { render, screen, fireEvent } from '@testing-library/react';
      import TodoItem from './TodoItem';
      import { Todo } from '../types';

      const mockTodo: Todo = {
        id: '1',
        text: 'Test Todo',
        completed: false,
        createdAt: new Date(),
      };

      describe('TodoItem Component', () => {
        const mockToggle = jest.fn();
        const mockDelete = jest.fn();
        const mockEdit = jest.fn();

        beforeEach(() => {
          render(
            <TodoItem
              todo={mockTodo}
              onToggle={mockToggle}
              onDelete={mockDelete}
              onEdit={mockEdit}
            />
          );
        });

        it('renders the todo text', () => {
          expect(screen.getByText('Test Todo')).toBeInTheDocument();
        });

        it('calls toggle function when checkbox is clicked', () => {
          fireEvent.click(screen.getByRole('checkbox'));
          expect(mockToggle).toHaveBeenCalledWith('1');
        });

        it('enters edit mode when edit button is clicked', () => {
          fireEvent.click(screen.getByText('Edit'));
          expect(screen.getByDisplayValue('Test Todo')).toBeInTheDocument();
        });

        it('calls delete function when delete button is clicked', () => {
          fireEvent.click(screen.getByText('Delete'));
          expect(mockDelete).toHaveBeenCalledWith('1');
        });

        it('saves edited text when form is submitted', () => {
          // Enter edit mode
          fireEvent.click(screen.getByText('Edit'));
          
          // Change the input value
          const input = screen.getByDisplayValue('Test Todo');
          fireEvent.change(input, { target: { value: 'Updated Todo' } });
          
          // Submit the form
          fireEvent.submit(screen.getByRole('form'));
          
          expect(mockEdit).toHaveBeenCalledWith('1', 'Updated Todo');
        });
      });
      \`\`\`

      ## Integration Testing

      Testing interactions between components:

      \`\`\`tsx
      // Integration tests for TodoList with TodoContext
      import { render, screen, fireEvent } from '@testing-library/react';
      import { TodoProvider } from '../context/TodoContext';
      import TodoList from './TodoList';
      import TodoForm from './TodoForm';

      describe('Todo Integration', () => {
        it('adds and displays a new todo', () => {
          render(
            <TodoProvider>
              <TodoForm />
              <TodoList />
            </TodoProvider>
          );
          
          // Add a new todo
          const input = screen.getByPlaceholderText('Add a new todo...');
          fireEvent.change(input, { target: { value: 'New Integration Todo' } });
          fireEvent.submit(screen.getByRole('form'));
          
          // Check if the new todo appears in the list
          expect(screen.getByText('New Integration Todo')).toBeInTheDocument();
        });

        it('toggles todo completion status', () => {
          render(
            <TodoProvider>
              <TodoForm />
              <TodoList />
            </TodoProvider>
          );
          
          // Add a new todo
          const input = screen.getByPlaceholderText('Add a new todo...');
          fireEvent.change(input, { target: { value: 'Toggle Test Todo' } });
          fireEvent.submit(screen.getByRole('form'));
          
          // Find the todo and its checkbox
          const todoItem = screen.getByText('Toggle Test Todo').closest('li');
          const checkbox = todoItem.querySelector('input[type="checkbox"]');
          
          // Toggle completion
          fireEvent.click(checkbox);
          
          // Verify the todo is marked as completed
          expect(todoItem).toHaveStyle('opacity: 0.6');
        });
      });
      \`\`\`

      ## E2E Testing

      Using Cypress for end-to-end testing:

      \`\`\`js
      // cypress/integration/todo.spec.js
      describe('Todo App E2E', () => {
        beforeEach(() => {
          // Clear localStorage before each test
          cy.clearLocalStorage();
          cy.visit('/');
        });
        
        it('should add, complete, and delete a todo', () => {
          // Add a new todo
          cy.get('[data-testid="todo-input"]').type('E2E Test Todo');
          cy.get('[data-testid="todo-form"]').submit();
          
          // Verify todo was added
          cy.contains('E2E Test Todo').should('be.visible');
          
          // Mark as completed
          cy.get('[data-testid="todo-item"]').first().find('input[type="checkbox"]').click();
          cy.get('[data-testid="todo-item"]').first().should('have.css', 'opacity', '0.6');
          
          // Delete the todo
          cy.get('[data-testid="todo-item"]').first().contains('Delete').click();
          cy.contains('E2E Test Todo').should('not.exist');
        });
        
        it('should filter todos correctly', () => {
          // Add todos in different states
          cy.get('[data-testid="todo-input"]').type('Active Todo');
          cy.get('[data-testid="todo-form"]').submit();
          
          cy.get('[data-testid="todo-input"]').type('Completed Todo');
          cy.get('[data-testid="todo-form"]').submit();
          
          // Mark second todo as complete
          cy.get('[data-testid="todo-item"]').eq(1).find('input[type="checkbox"]').click();
          
          // Filter by active
          cy.get('[data-testid="filter-active"]').click();
          cy.get('[data-testid="todo-item"]').should('have.length', 1);
          cy.contains('Active Todo').should('be.visible');
          cy.contains('Completed Todo').should('not.exist');
          
          // Filter by completed
          cy.get('[data-testid="filter-completed"]').click();
          cy.get('[data-testid="todo-item"]').should('have.length', 1);
          cy.contains('Completed Todo').should('be.visible');
          cy.contains('Active Todo').should('not.exist');
          
          // Show all
          cy.get('[data-testid="filter-all"]').click();
          cy.get('[data-testid="todo-item"]').should('have.length', 2);
        });
      });
      \`\`\`

      This testing strategy provides comprehensive coverage:
      - Unit tests for individual components
      - Integration tests for component interactions
      - E2E tests for complete user flows
      - Test coverage for all key features`,
      summary:
        'Comprehensive testing strategy for the React Todo app with unit, integration, and E2E testing examples',
    };
    await vectorRepo.addContext(testingStrategy.id, testingStrategy.text, testingStrategy.summary);

    // Add relationships
    await vectorRepo.addRelationship(todoItemComponent.id, testingStrategy.id, 'tested_by', 0.8);
    await vectorRepo.addRelationship(stateManagement.id, testingStrategy.id, 'tested_by', 0.75);
    console.log('✓ Added testing strategy with relationships');

    // Phase 6: User Feedback and Iterations
    console.log('\nPhase 6: User Feedback and Iterations');

    // Add user feedback and iterations
    const userFeedback = {
      id: 'user-feedback',
      text: `# User Feedback and Iterations on Todo App

      After the first round of user testing, we received the following feedback:

      ## User Feedback

      1. **Accessibility Issues**:
         - Color contrast too low for completed todos
         - Keyboard navigation difficult between todo items
         - No screen reader announcements for state changes

      2. **UX Improvements Needed**:
         - Need visual feedback when adding/completing todos
         - Todo completion not obvious enough
         - Missing due dates functionality
         - No way to prioritize tasks

      3. **Performance**:
         - Slow rendering with many todos
         - Lag when filtering large lists

      ## Implemented Iterations

      Based on this feedback, here are the iterations we implemented:

      ### Accessibility Improvements

      \`\`\`tsx
      // Improved TodoItem.tsx (partial)
      const TodoText = styled.span<{ completed: boolean }>\`
        flex: 1;
        text-decoration: \${({ completed }) => (completed ? 'line-through' : 'none')};
        color: \${({ completed }) => (completed ? '#555' : '#333')}; // Improved contrast
        font-weight: \${({ completed }) => (completed ? 'normal' : 'medium')};
      \`;

      // Enhanced focus management
      const TodoItem: FC<TodoItemProps> = ({ todo, onToggle, onDelete, onEdit }) => {
        // ... existing code ...
        
        // Add appropriate ARIA attributes
        return (
          <TodoItemContainer 
            data-testid="todo-item" 
            completed={todo.completed}
            role="listitem"
            aria-checked={todo.completed}
          >
            {/* ... */}
            <Checkbox
              type="checkbox"
              checked={todo.completed}
              onChange={() => {
                onToggle(todo.id);
                // Announce status change to screen readers
                const message = todo.completed ? 'Task marked incomplete' : 'Task completed';
                announceToScreenReader(message);
              }}
              aria-label={\`Mark "\${todo.text}" as \${todo.completed ? 'incomplete' : 'complete'}\`}
            />
            {/* ... */}
          </TodoItemContainer>
        );
      };

      // Screen reader announcement utility
      function announceToScreenReader(message: string) {
        const announcer = document.getElementById('announcer');
        if (announcer) {
          announcer.textContent = message;
        }
      }
      \`\`\`

      ### UX Enhancements

      \`\`\`tsx
      // Added TodoItem with priority and due date
      export interface Todo {
        id: string;
        text: string;
        completed: boolean;
        createdAt: Date;
        priority: 'low' | 'medium' | 'high';
        dueDate?: Date;
      }

      // TodoForm with priority and due date (partial)
      const TodoForm: FC = () => {
        const [text, setText] = useState('');
        const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
        const [dueDate, setDueDate] = useState<Date | undefined>();
        const { addTodo } = useTodoContext();
        
        const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          if (text.trim()) {
            addTodo(text, priority, dueDate);
            setText('');
            // Add visual feedback with animation
            animateAddTodo();
          }
        };
        
        return (
          <Form onSubmit={handleSubmit} data-testid="todo-form">
            <Input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a new todo..."
              data-testid="todo-input"
            />
            <PrioritySelect
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </PrioritySelect>
            <DateInput
              type="date"
              onChange={(e) => setDueDate(e.target.valueAsDate || undefined)}
            />
            <AddButton type="submit">Add</AddButton>
          </Form>
        );
      };
      \`\`\`

      ### Performance Optimizations

      \`\`\`tsx
      // Optimized rendering with React.memo and useCallback
      import { useCallback, memo } from 'react';

      const TodoItem = memo(({ todo, onToggle, onDelete, onEdit }: TodoItemProps) => {
        // Component implementation...
      });

      // In TodoContext
      const TodoProvider = ({ children }: { children: ReactNode }) => {
        // ...existing state
        
        // Memoized callbacks to prevent unnecessary rerenders
        const addTodo = useCallback((text: string, priority: string, dueDate?: Date) => {
          setTodos(prev => [
            ...prev,
            {
              id: Date.now().toString(),
              text,
              completed: false,
              createdAt: new Date(),
              priority,
              dueDate,
            },
          ]);
        }, []);
        
        const toggleTodo = useCallback((id: string) => {
          setTodos(prev =>
            prev.map((todo) =>
              todo.id === id ? { ...todo, completed: !todo.completed } : todo
            )
          );
        }, []);
        
        // ...other memoized actions
        
        // Memoized filtered todos
        const filteredTodos = useMemo(() => {
          return todos.filter((todo) => {
            if (filter === 'active') return !todo.completed;
            if (filter === 'completed') return todo.completed;
            return true;
          });
        }, [todos, filter]);
      };
      \`\`\`

      ## Results After Iterations

      The implemented changes significantly improved:

      1. **Accessibility**: App now meets WCAG AA standards
      2. **User Experience**: Task prioritization and due dates added
      3. **Performance**: App handles 1000+ todos with minimal lag

      User satisfaction scores increased from 72% to 94% after these changes.`,
      summary:
        'User feedback leading to iterations including accessibility improvements, UX enhancements, and performance optimizations',
    };
    await vectorRepo.addContext(userFeedback.id, userFeedback.text, userFeedback.summary);

    // Add relationships
    await vectorRepo.addRelationship(todoItemComponent.id, userFeedback.id, 'improved_by', 0.85);
    await vectorRepo.addRelationship(testingStrategy.id, userFeedback.id, 'validates', 0.7);
    console.log('✓ Added user feedback and iterations with relationships');

    // Phase 7: Complex Search Testing
    console.log('\nPhase 7: Complex Search Testing');

    // Test 1: Search for React component implementation
    const search1 = await vectorRepo.findSimilarContexts(
      'React todo item component with TypeScript',
      2
    );
    console.log(
      `Search 1: Found ${search1.length} results for "React todo item component with TypeScript"`
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

    // Verify relevant contexts for React components are found
    // Component information might be in testing or structure documents
    if (
      search1.length === 0 ||
      !(
        search1.some(
          (r) => r.contextId === 'todo-item-implementation' && (r.similarity ?? 0) > 0.45
        ) ||
        search1.some((r) => r.contextId === 'testing-strategy' && (r.similarity ?? 0) > 0.45) ||
        search1.some((r) => r.contextId === 'component-structure' && (r.similarity ?? 0) > 0.45)
      )
    ) {
      throw new Error(
        'Expected to find relevant context with high similarity for React component query'
      );
    }

    // Test 2: Search for state management
    const search2 = await vectorRepo.findSimilarContexts(
      'How is state managed in the React todo app?',
      2
    );
    console.log(
      `Search 2: Found ${search2.length} results for "How is state managed in the React todo app?"`
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

    // Verify relevant context for state management is found
    if (
      search2.length === 0 ||
      !(
        search2.some((r) => r.contextId === 'state-management' && (r.similarity ?? 0) > 0.45) ||
        search2.some((r) => r.contextId === 'testing-strategy' && (r.similarity ?? 0) > 0.7) ||
        search2.some((r) => r.contextId === 'project-requirements' && (r.similarity ?? 0) > 0.7)
      )
    ) {
      throw new Error(
        'Expected to find relevant context with high similarity for state management query'
      );
    }

    // Test 3: Search with code sample
    const search3 = await vectorRepo.findSimilarContexts(
      `
    export interface Todo {
      id: string;
      text: string;
      completed: boolean;
    }`,
      2
    );
    console.log(`Search 3: Found ${search3.length} results for Todo interface code snippet`);
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

    // Verify appropriate context is found with good similarity for Todo interface
    if (search3.length === 0 || !search3.some((r) => (r.similarity ?? 0) > 0.5)) {
      throw new Error('Expected to find any context with high similarity for Todo interface code');
    }

    // Test 4: Search for testing approach
    const search4 = await vectorRepo.findSimilarContexts(
      'How to test React components with testing library?',
      2
    );
    console.log(
      `Search 4: Found ${search4.length} results for "How to test React components with testing library?"`
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

    // Verify testing strategy or relevant context is found
    if (search4.length === 0 || !search4.some((r) => (r.similarity ?? 0) > 0.5)) {
      throw new Error('Expected to find context with high similarity for testing query');
    }

    // Test 5: Search for feedback and iterations
    const search5 = await vectorRepo.findSimilarContexts(
      'What accessibility improvements were made after feedback?',
      2
    );
    console.log(
      `Search 5: Found ${search5.length} results for accessibility improvements question`
    );
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

    // Verify any relevant context is found
    if (search5.length === 0 || !search5.some((r) => (r.similarity ?? 0) > 0.45)) {
      throw new Error(
        'Expected to find context with reasonable similarity for accessibility query'
      );
    }

    console.log('\n✓ All complex search tests passed');
    console.log(
      '\n=== React AI Development Scenario Integration Test Completed Successfully ===\n'
    );
  } catch (error) {
    console.error('React AI development scenario test failed:', error);
    process.exit(1);
  } finally {
    if (vectorRepo) {
      await vectorRepo.close();
      try {
        await fs.unlink(testDbPath);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }
    await cleanupTestEnvironment();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runReactAIDevelopmentScenario();
}

export { runReactAIDevelopmentScenario };
