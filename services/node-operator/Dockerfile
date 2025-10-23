FROM node:18-slim

WORKDIR /app

# Copy package files
COPY services/node-operator/package*.json ./
RUN npm ci --only=production

# Copy source
COPY services/node-operator/src ./src
COPY services/node-operator/tsconfig.json ./

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Run the service
CMD ["node", "dist/index.js"]

