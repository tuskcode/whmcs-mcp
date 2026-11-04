# Docker Deployment Guide

This guide explains how to run the WHMCS MCP Server using Docker.

## Prerequisites

- Docker 20.10 or later
- Docker Compose v2.0 or later (optional)
- WHMCS API credentials

## Quick Start

### Using Docker Compose (Recommended)

1. **Create environment file:**
   ```bash
   cp .env.example .env
   # Edit .env with your WHMCS credentials
   ```

2. **Build and run:**
   ```bash
   docker compose up -d
   ```

3. **View logs:**
   ```bash
   docker compose logs -f
   ```

4. **Stop the server:**
   ```bash
   docker compose down
   ```

### Using Docker Directly

1. **Build the image:**
   ```bash
   docker build -t whmcs-mcp-server .
   ```

2. **Run the container:**
   ```bash
   docker run -it --rm \
     -e WHMCS_API_URL="https://billing.example.com/" \
     -e WHMCS_API_IDENTIFIER="your-identifier" \
     -e WHMCS_API_SECRET="your-secret" \
     whmcs-mcp-server
   ```

### Using Pre-built Image

```bash
docker run -it --rm \
  -e WHMCS_API_URL="https://billing.example.com/" \
  -e WHMCS_API_IDENTIFIER="your-identifier" \
  -e WHMCS_API_SECRET="your-secret" \
  ghcr.io/scarecr0w12/whmcs-mcp-tool:latest
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WHMCS_API_URL` | Yes | Your WHMCS installation URL |
| `WHMCS_API_IDENTIFIER` | Yes | API credential identifier |
| `WHMCS_API_SECRET` | Yes | API credential secret |
| `WHMCS_ACCESS_KEY` | No | Optional API access key |

### Using with MCP Clients

#### Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "whmcs": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "WHMCS_API_URL=https://billing.example.com/",
        "-e", "WHMCS_API_IDENTIFIER=your-identifier",
        "-e", "WHMCS_API_SECRET=your-secret",
        "ghcr.io/scarecr0w12/whmcs-mcp-tool:latest"
      ]
    }
  }
}
```

#### VS Code with Docker

Update `.vscode/mcp.json`:

```json
{
  "servers": {
    "whmcs-mcp-server": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "WHMCS_API_URL",
        "-e", "WHMCS_API_IDENTIFIER",
        "-e", "WHMCS_API_SECRET",
        "-e", "WHMCS_ACCESS_KEY",
        "whmcs-mcp-server"
      ],
      "env": {
        "WHMCS_API_URL": "${env:WHMCS_API_URL}",
        "WHMCS_API_IDENTIFIER": "${env:WHMCS_API_IDENTIFIER}",
        "WHMCS_API_SECRET": "${env:WHMCS_API_SECRET}",
        "WHMCS_ACCESS_KEY": "${env:WHMCS_ACCESS_KEY}"
      }
    }
  }
}
```

## Building

### Development Build

```bash
# Build with default settings
docker build -t whmcs-mcp-server .

# Build with build args
docker build \
  --build-arg NODE_ENV=development \
  -t whmcs-mcp-server:dev .
```

### Multi-Platform Build

```bash
# Build for multiple architectures
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t whmcs-mcp-server:latest \
  --push .
```

## Security Considerations

1. **Non-root User**: The container runs as a non-root user (`mcpuser`) for security.

2. **Secrets Management**: 
   - Never hardcode credentials in Dockerfiles
   - Use environment variables or Docker secrets
   - Consider using a secrets manager in production

3. **Network Security**:
   - The container only needs outbound HTTPS access to your WHMCS installation
   - Consider using network policies to restrict access

4. **Image Updates**:
   - Regularly update the base image for security patches
   - Use specific version tags in production

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs whmcs-mcp-server

# Run interactively to see errors
docker run -it --rm \
  -e WHMCS_API_URL="..." \
  -e WHMCS_API_IDENTIFIER="..." \
  -e WHMCS_API_SECRET="..." \
  whmcs-mcp-server
```

### Connection Issues

1. Verify WHMCS URL is accessible from container:
   ```bash
   docker run --rm curlimages/curl -s https://your-whmcs-url/
   ```

2. Check environment variables are set correctly:
   ```bash
   docker inspect whmcs-mcp-server | grep -A 10 "Env"
   ```

### Permission Denied

If you see permission errors, ensure the container user has appropriate permissions:
```bash
# Check running user
docker exec whmcs-mcp-server whoami
```

## Image Sizes

| Stage | Approximate Size |
|-------|-----------------|
| Builder | ~300MB |
| Production | ~150MB |

The multi-stage build ensures the final image is as small as possible by excluding development dependencies and build tools.

## Build and run your verified fork

Use Node.js 24 in the multi-stage Dockerfile. From the checkout root:

```bash
docker build -t whmcs-mcp:local .
docker run --rm -i --env-file .env whmcs-mcp:local
```

This builds this checkout, rather than downloading a previous author's application
image. The runtime runs as the unprivileged `node` user and contains production
dependencies and compiled output only. `.env*` files are excluded from build
context; provide credentials at runtime. Use an HTTPS WHMCS URL without redirects.
The server uses stdio: connect it through an MCP client with command `docker` and
arguments `run --rm -i --env-file /absolute/path/to/.env whmcs-mcp:local`.
Do not use `-t` (a terminal can interfere with JSON-RPC). Initialization and
`tools/list` through the client are the readiness checks; no web port is exposed.

Mutations default to disabled; enabling `WHMCS_ALLOW_MUTATIONS=true` also requires
`confirm: true` on each mutating tool call. Read the data handling restrictions in
[Configuration](CONFIGURATION.md#data-visible-to-mcp-clients), including redaction
of module payloads and SSO tokens/links.

For managed environments with an HTTPS inspection proxy, keep TLS verification
and pass its public CA as a BuildKit secret (not a build argument or COPY):

```bash
docker build --secret id=proxy_ca,src="$CODEX_PROXY_CERT" -t whmcs-mcp:local .
```

When runtime HTTPS also uses that proxy, mount its CA read-only and set
`NODE_EXTRA_CA_CERTS` to the mounted path. The image does not contain a session CA.
