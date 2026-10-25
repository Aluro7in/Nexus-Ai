# Nexus AI — Cloud Run Production Container
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests and tsconfig
COPY package.json package-lock.json tsconfig.json ./

# Install dependencies including devDependencies for TypeScript compilation
RUN npm ci

# Copy source code
COPY src/ ./src/

# Compile TypeScript to JavaScript in /dist
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Copy package manifests and install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled JavaScript output from builder
COPY --from=builder /app/dist ./dist

# Non-root user for container security
USER node

EXPOSE 8080

CMD ["node", "dist/index.js"]
