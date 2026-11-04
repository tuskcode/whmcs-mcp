# syntax=docker/dockerfile:1
FROM node:24-alpine AS builder
WORKDIR /app
COPY --chmod=644 package.json package-lock.json ./
# Optional CA for environments with an HTTPS inspection proxy; never stored in layers.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --chmod=644 package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=builder --chown=node:node /app/dist ./dist
USER node
# stdio MCP has no HTTP health endpoint. Its client validates initialization.
CMD ["node", "dist/index.js"]
