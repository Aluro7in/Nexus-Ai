# Nexus AI Frontend — Production Container
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json tsconfig.json vite.config.ts ./

# Install dependencies for TypeScript compilation and Vite build
RUN npm ci

# Copy source code and application assets
COPY index.html ./
COPY src/ ./src/
COPY server/ ./server/
COPY server.ts ./

# Build frontend bundle into /dist
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package manifests and install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy server runtime files
COPY server/ ./server/
COPY server.ts ./

# Non-root user for container security
USER node

EXPOSE 3000

CMD ["node", "server.ts"]
