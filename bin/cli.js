#!/usr/bin/env node
// Suppress Node 25 UV_HANDLE_CLOSING assertion on Windows
process.on('exit', () => {});

/**
 * Maestro Fraud CLI
 * 
 * Query the Maestro Fraud Detection Platform from the command line.
 * Designed for both human operators and AI agents.
 * 
 * Setup:
 *   maestro-fraud login --url https://fraud.example.com --key fd_xxxxx
 * 
 * Usage:
 *   maestro-fraud chat "analyze account 12345"
 *   maestro-fraud search user@email.com
 *   maestro-fraud signals <account-id>
 *   maestro-fraud alerts [--status unacknowledged] [--severity critical]
 *   maestro-fraud stats
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.maestro-fraud');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

// ── Config ──────────────────────────────────────────────────────────────

function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch { return null; }
}

function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ── API Client ──────────────────────────────────────────────────────────

async function api(method, path, body = null) {
  const config = loadConfig();
  if (!config) {
    console.error('Not logged in. Run: maestro-fraud login --url <URL> --key <API_KEY>');
    process.exit(1);
  }

  const url = `${config.url.replace(/\/$/, '')}${path}`;
  const headers = {
    'X-API-Key': config.key,
    'Content-Type': 'application/json',
  };

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const data = await res.json();

  if (!data.success) {
    console.error(`Error: ${data.error}`);
    if (res.status === 429) {
      console.error(`Rate limited. Retry after ${res.headers.get('Retry-After')}s`);
    }
    process.exit(1);
  }

  return data;
}

// ── Commands ────────────────────────────────────────────────────────────

async function cmdLogin(args) {
  const urlIdx = args.indexOf('--url');
  const keyIdx = args.indexOf('--key');
  
  if (urlIdx === -1 || keyIdx === -1) {
    console.error('Usage: maestro-fraud login --url <PLATFORM_URL> --key <API_KEY>');
    console.error('Example: maestro-fraud login --url https://fraud.cipiti.ai --key fd_AbCdEfGh...');
    process.exit(1);
  }

  const url = args[urlIdx + 1];
  const key = args[keyIdx + 1];

  if (!url || !key) {
    console.error('Both --url and --key are required');
    process.exit(1);
  }

  // Test connection
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/api/v1/stats`, {
      headers: { 'X-API-Key': key },
    });
    const data = await res.json();
    if (!data.success) {
      console.error(`Connection failed: ${data.error}`);
      process.exit(1);
    }
    saveConfig({ url, key });
    console.log(`✅ Connected to ${url}`);
    console.log(`   Accounts: ${data.data.accounts.total}`);
    console.log(`   High risk: ${data.data.accounts.highRisk}`);
    console.log(`   Config saved to ${CONFIG_FILE}`);
  } catch (err) {
    console.error(`Connection failed: ${err.message}`);
    process.exit(1);
  }
}

async function cmdChat(args) {
  const message = args.join(' ');
  if (!message) {
    console.error('Usage: maestro-fraud chat "your question"');
    process.exit(1);
  }

  // Load session from config
  const config = loadConfig();
  const sessionId = config?.chatSessionId;

  const result = await api('POST', '/api/v1/chat', { 
    message,
    sessionId: sessionId || undefined,
  });

  // Save session for continuity
  if (result.data.sessionId && config) {
    config.chatSessionId = result.data.sessionId;
    saveConfig(config);
  }

  console.log(result.data.response);

  if (result.data.toolsUsed?.length) {
    console.error(`\n[Tools used: ${result.data.toolsUsed.join(', ')}]`);
  }
}

async function cmdSearch(args) {
  const query = args.join(' ');
  if (!query) {
    console.error('Usage: maestro-fraud search <email|id|username>');
    process.exit(1);
  }

  const result = await api('GET', `/api/v1/accounts/search?q=${encodeURIComponent(query)}`);
  
  if (result.data.length === 0) {
    console.log('No accounts found.');
    return;
  }

  for (const acct of result.data) {
    const risk = acct.riskScore >= 70 ? '🔴' : acct.riskScore >= 40 ? '🟡' : '🟢';
    console.log(`${risk} ${acct.externalId} | ${acct.email} | Risk: ${acct.riskScore} | Signals: ${acct.signalCount} | Bets: ${acct.totalBets} | ${acct.status}`);
  }

  if (result.pagination) {
    console.error(`\n[${result.pagination.total} total, page ${result.pagination.page}/${result.pagination.totalPages}]`);
  }
}

async function cmdSignals(args) {
  const accountId = args[0];
  if (!accountId) {
    console.error('Usage: maestro-fraud signals <account-id>');
    process.exit(1);
  }

  const limit = args.includes('--limit') ? args[args.indexOf('--limit') + 1] : '50';
  const result = await api('GET', `/api/v1/accounts/${accountId}/signals?limit=${limit}`);

  if (result.data.signals.length === 0) {
    console.log('No signals found for this account.');
    return;
  }

  for (const sig of result.data.signals) {
    const sev = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[sig.severity] || '⚪';
    console.log(`${sev} ${sig.signalType} | Confidence: ${(sig.confidence * 100).toFixed(0)}% | ${sig.detectorName || 'unknown'} | ${new Date(sig.createdAt).toISOString().split('T')[0]}`);
    if (sig.explanation) console.log(`  └─ ${sig.explanation}`);
  }
}

async function cmdAlerts(args) {
  const params = new URLSearchParams();
  
  const statusIdx = args.indexOf('--status');
  if (statusIdx !== -1) params.set('status', args[statusIdx + 1]);
  
  const sevIdx = args.indexOf('--severity');
  if (sevIdx !== -1) params.set('severity', args[sevIdx + 1]);
  
  const sinceIdx = args.indexOf('--since');
  if (sinceIdx !== -1) params.set('since', args[sinceIdx + 1]);
  
  const limitIdx = args.indexOf('--limit');
  params.set('limit', limitIdx !== -1 ? args[limitIdx + 1] : '20');

  const result = await api('GET', `/api/v1/alerts?${params.toString()}`);

  if (result.data.length === 0) {
    console.log('No alerts found.');
    return;
  }

  for (const alert of result.data) {
    const sev = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[alert.severity] || '⚪';
    const ack = alert.acknowledgedAt ? '✓' : '⬜';
    console.log(`${sev} ${ack} ${alert.title} | ${alert.type} | ${new Date(alert.createdAt).toISOString().split('T')[0]}`);
    if (alert.description) console.log(`  └─ ${alert.description}`);
  }

  if (result.pagination) {
    console.error(`\n[${result.pagination.total} total, ${result.pagination.total - result.data.filter(a => a.acknowledgedAt).length} unacknowledged]`);
  }
}

async function cmdStats() {
  const result = await api('GET', '/api/v1/stats');
  const s = result.data;

  console.log('═══ Platform Overview ═══');
  console.log(`\nAccounts: ${s.accounts.total} total`);
  console.log(`  Active: ${s.accounts.active} | Flagged: ${s.accounts.flagged} | Suspended: ${s.accounts.suspended}`);
  console.log(`  High risk: ${s.accounts.highRisk} | Avg risk score: ${s.accounts.avgRiskScore}`);
  console.log(`\nAlerts (7d): ${s.alerts.last7Days}`);
  console.log(`  🔴 ${s.alerts.critical} critical | 🟠 ${s.alerts.high} high | 🟡 ${s.alerts.medium} medium | 🟢 ${s.alerts.low} low`);
  console.log(`  Unacknowledged: ${s.alerts.unacknowledged}`);
  console.log(`\nSignals (7d): ${s.signals.last7Days} across ${s.signals.uniqueAccounts} accounts`);
  console.log(`\nBetting (7d): ${s.betting.last7Days.totalBets} bets | ${s.betting.last7Days.uniqueBettors} bettors`);
}

async function cmdNewChat() {
  const config = loadConfig();
  if (config) {
    delete config.chatSessionId;
    saveConfig(config);
    console.log('Chat session reset. Next chat message starts a new conversation.');
  }
}

// ── Main ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];
const cmdArgs = args.slice(1);

if (!command || command === '--help' || command === '-h') {
  console.log(`
maestro-fraud — Fraud Detection Platform CLI

Setup:
  login --url <URL> --key <KEY>    Connect to a fraud platform instance

Commands:
  chat <message>                   Chat with AI fraud analyst
  chat:new                         Start a new chat session
  search <query>                   Search accounts by email/ID/username
  signals <account-id>             Get fraud signals for an account
  alerts [options]                 List fraud alerts
    --status <ack|unack>           Filter by status
    --severity <critical|high|..>  Filter by severity
    --since <ISO-date>             Only alerts after this date
    --limit <n>                    Max results (default 20)
  stats                            Platform overview statistics

Examples:
  maestro-fraud login --url https://fraud.cipiti.ai --key fd_AbCdEfGh123
  maestro-fraud chat "analyze suspicious activity on account 12345"
  maestro-fraud search john@example.com
  maestro-fraud signals 550e8400-e29b-41d4-a716-446655440000
  maestro-fraud alerts --severity critical --status unacknowledged
  maestro-fraud stats
`);
  process.exit(0);
}

const commands = {
  login: cmdLogin,
  chat: cmdChat,
  'chat:new': cmdNewChat,
  search: cmdSearch,
  signals: cmdSignals,
  alerts: cmdAlerts,
  stats: cmdStats,
};

const handler = commands[command];
if (!handler) {
  console.error(`Unknown command: ${command}. Run 'maestro-fraud --help' for usage.`);
  process.exit(1);
}

handler(cmdArgs).catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
