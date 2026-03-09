---
name: maestro-fraud
description: Query the Maestro Fraud Detection Platform — search accounts, check signals, list alerts, get stats, and chat with AI fraud analyst. Use when the user asks about fraud, suspicious accounts, risk scores, or detection signals.
metadata:
  openclaw:
    emoji: "🕵️"
    requires:
      anyBins: ["maestro-fraud"]
    install:
      - id: node
        kind: node
        package: maestro-fraud
        bins: ["maestro-fraud"]
        label: "Install maestro-fraud CLI (npm)"
---

# Maestro Fraud Detection Skill

Query a Maestro Fraud Detection Platform instance via the `maestro-fraud` CLI.

## Prerequisites

The CLI must be installed and configured:

```bash
npm install -g maestro-fraud
maestro-fraud login --url https://fraud.example.com --key fd_YOUR_API_KEY
```

## When to Use

- User asks about suspicious accounts, fraud signals, or risk scores
- User wants to search for an account by email, ID, or username
- User wants to check alerts or platform statistics
- User wants AI-powered fraud analysis of specific accounts/patterns
- Another system/agent needs fraud intelligence

## Commands

### Chat with AI Analyst

For open-ended fraud questions. The AI analyst has access to all platform data.

```bash
# Ask about a specific account
maestro-fraud chat "analyze account 12345 for suspicious behavior"

# Ask about patterns
maestro-fraud chat "which accounts have the most password-hash-match signals this week?"

# Follow-up questions (session persists)
maestro-fraud chat "what about their betting patterns?"

# Start fresh conversation
maestro-fraud chat:new
```

**Use chat when:** the question is complex, needs analysis, or you're not sure which specific data to pull.

### Search Accounts

```bash
# By email
maestro-fraud search john@example.com

# By external ID (member ID)
maestro-fraud search 12345

# By username
maestro-fraud search johndoe
```

Output: risk score, signal count, bet count, status for each match.

### Get Signals for Account

```bash
# Get fraud detection signals
maestro-fraud signals <account-uuid>
maestro-fraud signals <account-uuid> --limit 10
```

Output: signal type, confidence, detector name, explanation.

### List Alerts

```bash
# All recent alerts
maestro-fraud alerts

# Critical unacknowledged only
maestro-fraud alerts --severity critical --status unacknowledged

# Since a date
maestro-fraud alerts --since 2026-03-01
```

### Platform Statistics

```bash
maestro-fraud stats
```

Returns: account counts, risk distribution, alert summary, signal volume, betting stats.

## Output Format

All commands output human-readable text to stdout. Metadata (pagination, tool usage) goes to stderr. This makes it easy to pipe output:

```bash
# Capture just the data
maestro-fraud search john@example.com 2>/dev/null

# Use in scripts
RISK=$(maestro-fraud search 12345 2>/dev/null | head -1)
```

## Error Handling

- **Not logged in:** Run `maestro-fraud login` first
- **Rate limited:** Wait and retry (headers show reset time)
- **Account not found:** Check the ID format (UUID for internal, numeric for external)

## Tips for AI Agents

1. **Start with `search`** to find account IDs before querying signals
2. **Use `chat`** for complex analysis — the AI analyst can query multiple data sources
3. **`stats`** gives a quick health check of the platform
4. **Session persistence:** `chat` remembers context, use `chat:new` to reset
5. **Parse output:** Each line of search/signals/alerts is one record, pipe-friendly
