# maestro-fraud

CLI for the Maestro Fraud Detection Platform. Query accounts, signals, alerts, and chat with an AI fraud analyst — all from the terminal.

Designed for both **human operators** and **AI agents** (via [ClawHub](https://clawhub.com) skill).

## Install

```bash
npm install -g maestro-fraud
```

## Setup

```bash
maestro-fraud login --url https://fraud.example.com --key fd_YOUR_API_KEY
```

Generate an API key from your fraud platform dashboard: **Settings → API Keys → Create**.

## Usage

```bash
# Chat with AI fraud analyst
maestro-fraud chat "analyze account 12345"

# Search accounts
maestro-fraud search user@email.com

# Get signals for an account
maestro-fraud signals <account-id>

# List alerts
maestro-fraud alerts --severity critical --status unacknowledged

# Platform overview
maestro-fraud stats
```

## AI Agent Integration

Install the ClawHub skill so AI agents can query your fraud platform:

```bash
clawhub install maestro-fraud
```

The skill teaches AI agents when and how to use this CLI for fraud-related queries.

## API

This CLI wraps the `/api/v1/` endpoints:

| Command | Endpoint | Scope Required |
|---------|----------|----------------|
| `chat` | `POST /api/v1/chat` | `chat:write` |
| `search` | `GET /api/v1/accounts/search` | `query:read` |
| `signals` | `GET /api/v1/accounts/:id/signals` | `query:read` |
| `alerts` | `GET /api/v1/alerts` | `alerts:read` |
| `stats` | `GET /api/v1/stats` | `query:read` |

## License

MIT
