# Security Policy

## Reporting a Vulnerability

To report a security vulnerability, please email **ansarmyrzagerey@gmail.com** rather than opening a public issue. We will respond within 72 hours.

## Secret Management

All secrets (database passwords, JWT keys, API tokens, email credentials) are managed via environment variables. See `.env.example` for the full list of required variables — never commit real secrets to the repository.
