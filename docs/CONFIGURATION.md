# WHMCS MCP Server - Configuration Guide

This guide explains how to configure the WHMCS MCP Server to connect to your WHMCS installation.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Creating WHMCS API Credentials](#creating-whmcs-api-credentials)
- [Environment Configuration](#environment-configuration)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before configuring the MCP server, ensure you have:

1. **WHMCS Installation** - A working WHMCS installation (version 7.2 or later recommended)
2. **Admin Access** - Administrator access to your WHMCS admin area
3. **API Enabled** - The WHMCS API must be enabled

## Creating WHMCS API Credentials

### Step 1: Access API Credentials

1. Log in to your WHMCS admin area
2. Navigate to **Setup** → **Staff Management** → **API Credentials**
3. Click **Generate New API Credential**

### Step 2: Configure the Credential

1. **Admin User**: Select the admin user this credential will act as
2. **Description**: Add a description like "MCP Server Integration"
3. Click **Generate**

### Step 3: Save the Credentials

After generation, you'll see:
- **Identifier**: A unique identifier string
- **Secret**: A secret key (only shown once!)

⚠️ **Important**: Copy and save the secret immediately. It cannot be retrieved later.

### Step 4: Configure IP Restrictions (Recommended)

For additional security:

1. In the API credential settings, find **Allowed IPs**
2. Add the IP addresses that will access the API
3. Leave blank to allow all IPs (not recommended for production)

## Environment Configuration

### Option 1: Environment Variables

Set environment variables directly:

```bash
export WHMCS_API_URL="https://billing.example.com/"
export WHMCS_API_IDENTIFIER="your-identifier-here"
export WHMCS_API_SECRET="your-secret-here"
export WHMCS_ACCESS_KEY=""  # Optional
```

### Option 2: .env File (Recommended)

Create a `.env` file in the project root:

```env
# Required: Your WHMCS installation URL
# Include the trailing slash
WHMCS_API_URL=https://billing.example.com/

# Required: API credential identifier
WHMCS_API_IDENTIFIER=your-identifier-here

# Required: API credential secret
WHMCS_API_SECRET=your-secret-here

# Optional: API access key for additional security
WHMCS_ACCESS_KEY=
```

### Configuration Options

| Variable | Required | Description |
|----------|----------|-------------|
| `WHMCS_API_URL` | Yes | Full URL to your WHMCS installation. Include the trailing slash. |
| `WHMCS_API_IDENTIFIER` | Yes | The API credential identifier from WHMCS |
| `WHMCS_API_SECRET` | Yes | The API credential secret from WHMCS |
| `WHMCS_ACCESS_KEY` | No | Optional API access key for additional security |

### Setting Up the API Access Key (Optional)

For additional security, you can require an API access key:

1. In WHMCS admin, go to **Setup** → **General Settings** → **Security**
2. Find the **API Access Key** field
3. Enter a strong, unique key
4. Save changes
5. Add this key to your `WHMCS_ACCESS_KEY` environment variable

## Security Best Practices

### 1. Protect Your Credentials

- **Never commit `.env` files** to version control
- Store credentials securely using a secrets manager in production
- Rotate credentials periodically

### 2. Use IP Restrictions

- Configure allowed IPs in WHMCS API credential settings
- Only allow necessary IP addresses

### 3. Use HTTPS

- Always use HTTPS for your WHMCS installation
- The API sends credentials over the network

### 4. Minimal Permissions

- WHMCS API credentials inherit the permissions of the associated admin user
- Consider creating a dedicated admin user with only necessary permissions

### 5. Enable API Access Key

- Use the optional `WHMCS_ACCESS_KEY` for an additional authentication layer

### 6. Monitor API Usage

- Regularly check WHMCS activity logs for API usage
- Set up alerts for unusual activity

## Troubleshooting

### Connection Issues

**Error: "WHMCS API request failed"**

1. Verify the `WHMCS_API_URL` is correct and accessible
2. Check if WHMCS is online
3. Ensure the URL includes the trailing slash
4. Verify HTTPS certificate is valid

**Error: "Authentication failed"**

1. Verify the API identifier and secret are correct
2. Check if the API credential is still active in WHMCS
3. If using an access key, verify it matches WHMCS settings
4. Check IP restrictions if configured

### Testing the Connection

Run the test script to verify your configuration:

```bash
npx tsx src/test.ts
```

Expected output for a successful connection:
```
Testing WHMCS API connection...
URL: https://billing.example.com/
Identifier: ***XXXX

--- Testing GetStats ---
✓ Connection successful!
...

✅ All tests passed! WHMCS MCP Server is ready to use.
```

### Common Issues

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| "Invalid IP" | IP not whitelisted | Add your IP to allowed IPs in WHMCS |
| "Invalid Credentials" | Wrong identifier/secret | Regenerate credentials in WHMCS |
| "API Disabled" | API not enabled | Enable API in WHMCS General Settings |
| "Access Denied" | Access key mismatch | Verify WHMCS_ACCESS_KEY matches WHMCS |
| "Connection Refused" | Wrong URL | Check WHMCS_API_URL is correct |

### Debug Mode

For detailed debugging, you can modify the API client to log requests:

```typescript
// In whmcs-client.ts, add logging to the call method
console.log('API Request:', { action, params });
console.log('API Response:', data);
```

## VS Code Configuration

The MCP server is pre-configured for VS Code in `.vscode/mcp.json`:

```json
{
    "servers": {
        "whmcs-mcp-server": {
            "type": "stdio",
            "command": "node",
            "args": ["dist/index.js"],
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

This configuration uses environment variables, which you should set in your system or use a `.env` file.

## Next Steps

Once configured, you can:

1. Run `npm run dev` to start the MCP server
2. Use the tools through VS Code or another MCP client
3. See the [API Reference](./API_REFERENCE.md) for available tools

### Credential transport security

`WHMCS_API_URL` must use HTTPS and point directly to the final WHMCS installation
URL (without `includes/api.php`). Redirects are rejected, including redirects to
another HTTPS host. Fix the configured URL instead of relying on redirection.
URLs containing user information, query parameters or fragments are rejected.
For local mock development only, `WHMCS_ALLOW_INSECURE_LOCALHOST=true` allows HTTP
on `localhost`, `127.0.0.1` or `::1`. It never permits HTTP to remote hosts.

All mutating MCP tools require `WHMCS_ALLOW_MUTATIONS=true` and `confirm: true`
in each call. Grant the WHMCS API credential only the permissions actually needed;
for read-only use, deny mutating API actions in WHMCS as well.

### Data visible to MCP clients

API results are returned to your MCP client and may be processed by its AI
provider. Customer names, emails, tickets and billing data needed by the selected
tool are still personal data: choose a client/provider and retention policy
appropriate for that data. Ticket text and other remote content are untrusted
input; never treat them as authorization for an action.

Credential-like response fields and occurrences of the configured API credentials
are redacted before results reach MCP. Module debug log request/response bodies
are always replaced with `[REDACTED]`; inspect original payloads directly in WHMCS
when needed. This is not a general anonymizer of arbitrary free text.
`WHMCS_DEBUG=true` logs only request events and HTTP status, without API parameters
or response bodies. Do not capture production fixtures with `npm run capture`
without manually reviewing their contents: its PII scrubber is not exhaustive.
Token-bearing URLs (including SSO login links) and SSO tokens are also redacted;
the auto-auth tool therefore no longer exposes usable login credentials to the AI.
Retrieve login links directly through the trusted WHMCS administration interface.
