# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | ✅        |
| < 0.2   | ❌        |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public issue.**
2. Email: [security@hrkit.dev](mailto:security@hrkit.dev) or use [GitHub Security Advisories](https://github.com/josedab/hrkit/security/advisories/new).
3. Include a description of the vulnerability, steps to reproduce, and potential impact.
4. We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Scope

This policy covers:
- All `@hrkit/*` packages published on npm
- The hrkit repository on GitHub

## Best Practices for SDK Users

- Keep `@hrkit/*` packages updated to the latest version
- Do not log or expose BLE device identifiers in production
- Use HTTPS when transmitting heart rate data over networks
- The `@hrkit/server` package binds to `127.0.0.1` by default — do not expose to public networks without authentication
