FROM node:18-slim

WORKDIR /app

# Copy package files
COPY services/attestor/package*.json ./
RUN npm ci --only=production

# Copy source
COPY services/attestor/src ./src
COPY services/attestor/tsconfig.json ./

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 8787

# Run the service
CMD ["node", "dist/index.js"]

