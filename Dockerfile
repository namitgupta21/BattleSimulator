# ==============================================================================
# Stage 1: Build C++ Native Engine & TypeScript Workspaces
# ==============================================================================
FROM --platform=linux/amd64 node:22-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/engine-binding/package.json ./packages/engine-binding/
COPY apps/server/package.json ./apps/server/

RUN npm ci

# Copy sources for native build & TypeScript build
COPY CMakeLists.txt ./
COPY engine/ ./engine/
COPY apps/cli/ ./apps/cli/
COPY tests/ ./tests/
COPY data/ ./data/
COPY packages/ ./packages/
COPY apps/server/ ./apps/server/

# Build C++ native engine binding
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --target pokemon_engine_binding

# Ensure native addon binary is copied to engine-binding output folder
RUN mkdir -p packages/engine-binding/build \
    && cp build/packages/engine-binding/pokemon_engine_binding.node packages/engine-binding/build/

# Build TypeScript workspaces in topological order
RUN npm run build --workspace=@pokemon/protocol \
    && npm run build --workspace=@pokemon/engine-binding \
    && npm run build --workspace=@pokemon/server

# Prune devDependencies to keep production image footprint minimal
RUN npm prune --production

# ==============================================================================
# Stage 2: Minimal Production Runtime
# ==============================================================================
FROM --platform=linux/amd64 node:22-bookworm-slim AS runner

ARG GIT_SHA=dev
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    GIT_SHA=${GIT_SHA} \
    NODE_OPTIONS="--max-old-space-size=256"

WORKDIR /app

# Copy production artifacts with ownership set to unprivileged node user
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules/ ./node_modules/
COPY --chown=node:node --from=builder /app/packages/ ./packages/
COPY --chown=node:node --from=builder /app/apps/server/ ./apps/server/
COPY --chown=node:node --from=builder /app/data/ ./data/

# Switch to non-root user
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/server/dist/src/index.js"]
