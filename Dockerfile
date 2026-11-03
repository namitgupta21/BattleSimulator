# Stage 1: Build C++ engine, native N-API binding, and TypeScript workspaces
FROM node:22-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/engine-binding/package.json ./packages/engine-binding/
COPY apps/server/package.json ./apps/server/

RUN npm ci

COPY CMakeLists.txt ./
COPY engine/ ./engine/
COPY apps/cli/ ./apps/cli/
COPY tests/ ./tests/
COPY data/ ./data/
COPY packages/ ./packages/
COPY apps/server/ ./apps/server/

# Build C++ engine and native addon
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --target pokemon_engine_binding

# Ensure native addon is in packages/engine-binding/build
RUN mkdir -p packages/engine-binding/build \
    && cp build/packages/engine-binding/pokemon_engine_binding.node packages/engine-binding/build/ || true

# Build all TypeScript packages
RUN npm run build

# Stage 2: Minimal Production Runtime
FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/server/ ./apps/server/
COPY --from=builder /app/data/ ./data/

EXPOSE 3000

CMD ["node", "apps/server/dist/src/index.js"]
