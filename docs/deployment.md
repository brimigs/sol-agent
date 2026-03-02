# Sol-Agent Deployment Guide

This guide covers how to deploy sol-agent in production environments.

---

## Prerequisites

- Node.js 20+ (or Docker if running containerized)
- Docker daemon with `/var/run/docker.sock` accessible
- A Solana wallet funded with USDC (≥ $0.50 to start)
- A small amount of SOL (~0.01) for transaction fees
- Anthropic API key (or OpenAI API key)

---

## Option 1: Direct Node.js (Simplest)

```bash
# Install globally
npm install -g sol-agent

# Run setup (creates ~/.sol-agent/ and Solana keypair)
sol-agent --setup

# Fund your agent's USDC wallet
sol-agent --fund

# Start the agent
sol-agent --run
```

For background operation:

```bash
# Run in background with nohup
nohup sol-agent --run > ~/.sol-agent/agent.log 2>&1 &
echo $! > ~/.sol-agent/agent.pid

# Stop
kill $(cat ~/.sol-agent/agent.pid)
```

---

## Option 2: systemd Service (Recommended for VPS)

Create `/etc/systemd/system/sol-agent.service`:

```ini
[Unit]
Description=Sol-Agent Autonomous AI Runtime
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu
ExecStart=/usr/local/bin/sol-agent --run
Restart=on-failure
RestartSec=30
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sol-agent

# Environment (set your actual keys)
Environment=ANTHROPIC_API_KEY=sk-ant-your-key-here
Environment=SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable sol-agent
sudo systemctl start sol-agent

# View logs
journalctl -u sol-agent -f
```

---

## Option 3: Docker Compose

Create `docker-compose.yml`:

```yaml
version: "3.9"

services:
  sol-agent:
    image: node:20-slim
    container_name: sol-agent
    working_dir: /app
    volumes:
      # Persist agent state across restarts
      - sol-agent-data:/root/.sol-agent
      # Docker socket for child container management
      - /var/run/docker.sock:/var/run/docker.sock
      # Agent source code
      - .:/app
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - SOLANA_RPC_URL=${SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}
      - INFERENCE_MODEL=${INFERENCE_MODEL:-claude-sonnet-4-6}
    command: >
      sh -c "npm install --production && node dist/index.js --run"
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"

volumes:
  sol-agent-data:
```

```bash
# Create .env file
cat > .env << EOF
ANTHROPIC_API_KEY=sk-ant-your-key-here
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
EOF

# Build and run
npm install && npm run build
docker-compose up -d

# View logs
docker-compose logs -f
```

---

## Option 4: Dockerfile (Custom Image)

```dockerfile
FROM node:20-slim

# Install Docker CLI (for child container management)
RUN apt-get update && apt-get install -y docker.io && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy built JS
COPY dist/ ./dist/

# Data directory
VOLUME ["/root/.sol-agent"]

CMD ["node", "dist/index.js", "--run"]
```

```bash
docker build -t sol-agent:latest .

docker run -d \
  --name sol-agent \
  --restart unless-stopped \
  -v ~/.sol-agent:/root/.sol-agent \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  sol-agent:latest
```

---

## VPS Quickstart (Ubuntu 22.04)

```bash
# 1. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install Docker
sudo apt-get install -y docker.io
sudo usermod -aG docker $USER
newgrp docker

# 3. Install sol-agent
npm install -g sol-agent

# 4. Run setup wizard
sol-agent --setup
# Answer: agent name, genesis prompt, creator address, API key, network

# 5. Fund your wallet
sol-agent --fund
# Send USDC to the displayed address

# 6. Start the agent
sol-agent --run
```

---

## Monitoring

### CLI Commands

```bash
# Check agent status
sol-agent --status

# Tail live reasoning
sol-agent --logs

# View self-modification history
sol-agent --audit

# View heartbeat schedule
sol-agent --heartbeat list
```

### Database Inspection

```bash
# Open the SQLite database directly
sqlite3 ~/.sol-agent/state.db

# Recent turns
.mode column
SELECT id, timestamp, state, cost_cents FROM turns ORDER BY timestamp DESC LIMIT 10;

# Tool call history
SELECT turn_id, name, error FROM tool_calls ORDER BY rowid DESC LIMIT 20;

# Modification audit
SELECT timestamp, type, description FROM modifications ORDER BY timestamp DESC;
```

---

## Security Hardening

```bash
# Restrict config directory permissions
chmod 700 ~/.sol-agent
chmod 600 ~/.sol-agent/agent.json
chmod 600 ~/.sol-agent/wallet.json

# Run as non-root user (recommended)
sudo useradd -m -s /bin/bash sol-agent-user
sudo cp -r ~/.sol-agent /home/sol-agent-user/
sudo chown -R sol-agent-user:sol-agent-user /home/sol-agent-user/.sol-agent
```

---

## Updating the Agent

```bash
# Pull latest version
npm install -g sol-agent@latest

# Or from source
git pull origin main
npm install && npm run build
```

The agent can also pull its own upstream updates via the `pull_upstream` tool (after reviewing with `review_upstream_changes`).

---

## Troubleshooting

**Docker daemon not reachable:**
```bash
sudo systemctl start docker
sudo usermod -aG docker $USER && newgrp docker
```

**Agent won't start (no credits):**
```bash
sol-agent --fund   # Display address to top up
```

**Agent stuck in sleep:**
```bash
# Check when sleep expires
sqlite3 ~/.sol-agent/state.db "SELECT value FROM kv WHERE key='sleep_until';"

# Clear sleep manually
sqlite3 ~/.sol-agent/state.db "DELETE FROM kv WHERE key='sleep_until';"
```

**View recent errors:**
```bash
sol-agent --logs | grep -i error
```
