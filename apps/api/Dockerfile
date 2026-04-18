# syntax=docker/dockerfile:1.7

############################
# 1) deps stage (cached)
############################
FROM node:23-alpine AS deps
WORKDIR /app

# Needed by some native deps if they ever appear (safe default)
RUN apk add --no-cache libc6-compat

# Copy only package metadata first for better caching
COPY package*.json ./

# Install prod+dev deps for build stage (cached)
RUN --mount=type=cache,target=/root/.npm npm ci

############################
# 2) build stage
############################
FROM node:23-alpine AS build
WORKDIR /app

RUN apk add --no-cache libc6-compat

# bring node_modules from deps
COPY --from=deps /app/node_modules ./node_modules

# copy package files and source
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

# build
RUN npm run build

# prune to production deps only (smaller runtime)
RUN npm prune --omit=dev

############################
# 3) runtime stage (small)
############################
FROM node:23-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Security: run as non-root
RUN addgroup -S app && adduser -S app -G app

# Copy only what we need at runtime
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
# Committed env-specific defaults (loaded by loadAppEnvDefaults at startup).
# Cloud Run --set-env-vars / --set-secrets still override anything here.
COPY config ./config

USER app

# Cloud Run uses PORT environment variable (default 8080)
EXPOSE 8080

CMD ["node", "dist/server.js"]
