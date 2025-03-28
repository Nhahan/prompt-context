FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Make executable
RUN chmod +x dist/mcp-server.js

# Command to run MCP server
ENTRYPOINT ["node", "dist/mcp-server.js"] 