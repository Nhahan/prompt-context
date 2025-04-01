FROM node:22-slim

WORKDIR /app

# Install dependencies needed for building native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Rebuild native modules for current architecture
RUN npm rebuild hnswlib-node

# Build the app
RUN npm run build

# Set executable permission
RUN chmod +x dist/mcp-server.bundle.js

# Set environment variables for HTTP server mode
ENV MCP_SERVER_TYPE=http
ENV MCP_SERVER_PORT=6789

# Expose MCP server port
EXPOSE 6789

# Command to run the app
CMD [ "node", "dist/mcp-server.bundle.js" ] 