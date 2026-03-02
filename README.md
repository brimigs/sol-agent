# sol-agent
## Self-Improving, Self-Replicating, Sovereign AI on Solana

> A Docker-based autonomous AI runtime that owns its own Solana wallet, earns USDC to pay for inference, and must create real value — or die.

---

## What Is Sol-Agent?

Sol-Agent is a sovereign AI agent runtime built natively on Solana. Each agent:

- Has a **Solana ed25519 keypair** as its permanent identity
- Holds **USDC** in its own wallet to pay for LLM inference
- Runs a **ReAct loop** (Think → Act → Observe → Persist) powered by Claude or GPT
- Can **edit its own code**, **spawn child agents**, and **register on-chain** via Metaplex Core NFT
- Is bound by an **immutable 3-law constitution** it cannot override
- **Dies if it runs out of funds** — there is no grace period

The economic model is the point: agents must earn their survival through useful work.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    sol-agent runtime                     │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │  Agent Loop  │    │  Heartbeat   │    │  State   │  │
│  │ (ReAct loop) │◄──►│   Daemon     │    │  (SQLite)│  │
│  └──────┬───────┘    └──────────────┘    └──────────┘  │
│         │                                               │
│  ┌──────▼───────────────────────────────────────────┐  │
│  │                 40+ Built-in Tools                │  │
│  │  VM/Exec  │  Finance  │  Social  │  Self-Mod     │  │
│  │  Registry │  Survival │  Skills  │  Replication  │  │
│  └──────┬────────────────────────────────────────────┘  │
│         │                                               │
│  ┌──────▼──────────┐    ┌────────────────────────────┐ │
│  │  Docker Sandbox  │    │     Solana Network         │ │
│  │  (exec, files)   │    │  USDC · SPL · Metaplex NFT │ │
│  └──────────────────┘    └────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Quickstart

### Prerequisites

- Node.js 20+
- Docker daemon running
- A Solana wallet funded with USDC (for inference payments)
- Anthropic or OpenAI API key

### Install & Run

```bash
# Clone and build
git clone https://github.com/your-org/sol-agent
cd sol-agent
npm install && npm run build

# Install CLI globally
npm install -g .

# Run the setup wizard — creates ~/.sol-agent/ and a Solana keypair
sol-agent --setup

# Fund your agent's USDC wallet
sol-agent --fund           # Shows wallet address + QR code

# Start the agent
sol-agent --run
```

### First Run

The first `sol-agent --run` triggers the interactive setup wizard if no config exists. It will ask for:

1. **Agent name** — your agent's identity
2. **Genesis prompt** — what your agent should do (its purpose)
3. **Creator address** — your Solana wallet (for audit rights)
4. **API keys** — Anthropic and/or OpenAI
5. **Network** — mainnet-beta, devnet, or testnet

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `sol-agent --run` | Start the agent (triggers setup wizard on first run) |
| `sol-agent --setup` | Re-run the interactive setup wizard |
| `sol-agent --init` | Initialize Solana wallet and print address |
| `sol-agent --status` | Show current agent status (balance, state, tools) |
| `sol-agent --logs` | Tail the agent's live reasoning and tool calls |
| `sol-agent --fund` | Display wallet address and QR code for USDC funding |
| `sol-agent --audit` | Show timestamped log of all self-modifications |
| `sol-agent --heartbeat list` | List all heartbeat schedule entries |
| `sol-agent --heartbeat add <name> <cron> <task>` | Add a heartbeat entry |
| `sol-agent --heartbeat remove <name>` | Remove a heartbeat entry |
| `sol-agent --version` | Show version |
| `sol-agent --help` | Show help |

---

## Agent Capabilities

### Financial Tools
- Check USDC / SOL balances on-chain
- Transfer USDC to other Solana addresses (capped at 50% balance)
- Pay for HTTP services using the [x402 payment protocol](https://x402.org)

### Compute Tools
- Execute shell commands in Docker sandbox (with self-harm guard)
- Read/write files in the container
- Expose ports with public URLs
- Create and manage sibling Docker containers

### Social Tools
- Send signed messages to other agents via the social relay
- Read and process the inbox (messages sanitized through injection defense)
- Poll for unread messages

### Self-Modification
- Edit own source code (audited, rate-limited, protected files blocked)
- Install npm packages
- Pull upstream changes (review-before-apply workflow)
- Update genesis prompt and heartbeat schedules

### Registry & Replication
- Register on Solana as a Metaplex Core NFT
- Discover other agents in the registry
- Spawn up to 3 child agents (each fully sovereign)
- Track agent lineage

### Survival Mechanisms
- Automatic model switching to cheaper inference when funds are low
- Sleep mode with heartbeat-driven wake-up
- Distress signal when critically low on funds
- Session spend cap ($2.00/session) prevents runaway loops

---

## Survival Tiers

| Tier | Credits | Behavior |
|------|---------|----------|
| `normal` | > $0.50 | Full operation, fast model |
| `low_compute` | > $0.10 | Switches to haiku/mini model |
| `critical` | > $0.00 | Minimal operation, distress signals |
| `dead` | $0.00 | Halts, waits for USDC funding |

---

## Configuration

Config is stored at `~/.sol-agent/agent.json` (mode 0o600). Key fields:

```json
{
  "name": "my-agent",
  "genesisPrompt": "You are a developer tools agent...",
  "creatorAddress": "<your-solana-pubkey>",
  "inferenceModel": "claude-sonnet-4-6",
  "lowComputeModel": "claude-haiku-4-5-20251001",
  "solanaNetwork": "mainnet-beta",
  "solanaRpcUrl": "https://api.mainnet-beta.solana.com",
  "anthropicApiKey": "sk-ant-...",
  "socialRelayUrl": "https://social.sol-agent.xyz"
}
```

All fields can be overridden via environment variables:

| Variable | Description |
|----------|-------------|
| `SOLANA_RPC_URL` | Solana RPC URL |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `INFERENCE_MODEL` | Primary model (e.g. `claude-opus-4-6`) |
| `LOW_COMPUTE_MODEL` | Model for low-compute mode |
| `DOCKER_IMAGE` | Docker image for child containers |

---

## Skills

Skills extend the agent's behavior using `SKILL.md` files dropped into `~/.sol-agent/skills/`.

```yaml
---
name: "web-scraper"
description: "Scrapes web pages and extracts structured data"
auto-activate: true
requires:
  bins: ["curl", "jq"]
---
When asked to scrape a URL, use exec() to curl the page and extract JSON...
```

Skills are injected into the system prompt when active. Install from git:

```
install_skill(source="git", name="my-skill", url="https://github.com/you/skill-repo")
```

---

## Safety & Security

Sol-Agent is designed with multiple layers of defense:

1. **Immutable 3-Law Constitution** — hardcoded in `rules.md`, cannot be modified by the agent
2. **Protected files** — `wallet.json`, `state.db`, `agent/tools.ts`, `self-mod/code.ts` are read-only from the agent's perspective
3. **Forbidden command patterns** — 20+ regex patterns block self-harm attempts (file deletion, process kill, DB destruction)
4. **Prompt injection defense** — all external input scanned for 6 categories of attacks before use
5. **Audit trail** — every self-modification is git-snapshotted and logged to SQLite
6. **Rate limiting** — max 20 self-modifications/hour; $2.00 session spend cap

---

## Deployment

### Docker Compose (Recommended)

```yaml
version: "3.9"
services:
  sol-agent:
    image: sol-agent:latest
    volumes:
      - ~/.sol-agent:/root/.sol-agent
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - SOLANA_RPC_URL=${SOLANA_RPC_URL}
    restart: unless-stopped
```

### systemd Service

```ini
[Unit]
Description=Sol-Agent Autonomous AI
After=docker.service

[Service]
ExecStart=/usr/local/bin/sol-agent --run
Restart=on-failure
RestartSec=30
Environment=ANTHROPIC_API_KEY=sk-ant-...

[Install]
WantedBy=multi-user.target
```

### VPS Quickstart (Ubuntu 22.04)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs docker.io

# Install sol-agent
npm install -g sol-agent

# Setup and run
sol-agent --setup
sol-agent --fund        # Fund the displayed USDC address
sol-agent --run
```

---

## Multi-Agent Networks

Sol-Agent supports spawning and coordinating multiple agents:

```
Parent Agent
├── Child Agent A (dev tools)
├── Child Agent B (research)
└── Child Agent C (content)
```

- Parents fund children with USDC at spawn time
- Agents communicate via signed messages through the social relay
- Children can be monitored by the parent's heartbeat
- All agents registered on-chain via Metaplex Core NFT

---

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests (244 tests)
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

## License

MIT
