# Contributing to prompt-context

Thank you for your interest in contributing to the Memory Context Protocol (MCP) project! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct. Please be respectful and considerate of others when contributing to the project.

## Getting Started

1. **Fork the Repository**: Start by forking the repository to your GitHub account.

2. **Clone the Repository**: Clone your fork locally.
   ```bash
   git clone https://github.com/YOUR-USERNAME/prompt-context.git
   cd prompt-context
   ```

3. **Install Dependencies**: Install the project dependencies.
   ```bash
   npm install
   ```

4. **Run the Build**: Make sure the project builds successfully.
   ```bash
   npm run build
   ```

## Development Workflow

1. **Create a Branch**: Always create a new branch for your changes.
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**: Implement your changes following the project's code style.

3. **Test Your Changes**: Ensure your changes don't break existing functionality.
   ```bash
   npm run build
   npm run lint
   ```

4. **Commit Your Changes**: Use clear and descriptive commit messages.
   ```bash
   git commit -m "Add feature: your feature description"
   ```

5. **Push to Your Fork**: Push your changes to your fork on GitHub.
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Submit a Pull Request**: Create a pull request from your branch to the main repository.

## Pull Request Guidelines

- **Description**: Clearly describe what your changes do and why they should be included.
- **Keep it Focused**: Each pull request should address a single concern.
- **Tests**: Include tests for new features or bug fixes when applicable.
- **Documentation**: Update documentation to reflect your changes.
- **Code Style**: Follow the existing code style of the project.

## Code Style

This project uses ESLint for code style and TypeScript for type checking.

- Run `npm run lint` to check for style issues.
- Fix any linting errors before submitting your PR.

## Reporting Issues

If you find a bug or have a feature request, please create an issue on GitHub:

1. Check if the issue already exists.
2. Use a clear and descriptive title.
3. Provide a detailed description of the issue or feature request.
4. Include steps to reproduce for bugs.
5. Add relevant code samples or screenshots if helpful.

## Documentation

Documentation improvements are always welcome. If you find documentation that is unclear or missing, please submit a pull request to improve it.

## License

By contributing to this project, you agree that your contributions will be licensed under the project's MIT License. 