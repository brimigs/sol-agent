# Sol-Agent Product Review
*Last updated: iteration 2 — all P0/P1/P2 items implemented*

## What Sol-Agent Is
A Docker-based sovereign AI runtime that earns its own existence through USDC on Solana. The agent has a Solana keypair identity, runs a ReAct loop, can self-modify its code, spawn child agents, communicate via signed messages, and must pay for inference from its own wallet or die.

---

## Concise Findings

### ✅ What's Working Well
- **Economic model is compelling** — agent must earn survival, creates real incentive alignment
- **Safety architecture is thorough** — immutable constitution, injection defense, protected files, forbidden command patterns
- **Solana integration is complete** — ed25519 identity, USDC transfers, SPL tokens, x402 payments, Metaplex NFT registry
- **Self-modification is audited** — rate-limited, git-snapshotted, protected-file-checked before any code edit
- **40+ tools across 7 categories** — compute, finance, survival, self-mod, replication, skills, registry
- **TypeScript + 244 tests** — solid foundation, well-typed interfaces, unit/integration/mocked coverage
- **Graceful degradation** — tiered survival states (normal → low_compute → critical → dead) with model switching
- **Heartbeat daemon** — cron-scheduled background tasks survive sleep cycles

### ⚠️ Important Features (Must Keep)
- Solana USDC balance as compute credit source
- Immutable 3-law constitution (cannot be overwritten)
- Injection defense pipeline (all external input sanitized)
- Protected files list (wallet.json, state.db, tools.ts, loop.ts cannot be agent-edited)
- Session spend cap ($2.00/session) + exponential backoff on errors
- `spawn_child` with max-children limit
- x402 payment protocol with `maxAmountUsdc` cap

### 🔧 Should Be Changed
- **README is 42 lines** — product this ambitious deserves a real README with architecture diagram, quickstart, and "what can it do" examples
- **Heartbeat config is raw YAML** — no schema validation, no setup wizard support, cron syntax is unfamiliar; needs a `heartbeat add` CLI command
- **Skills are instructions-only** — skills can't register new tools, just inject text into system prompt; architectural limitation that caps extensibility
- **Docker is hard requirement** — validateDockerConnection throws on startup; need graceful fallback or clear pre-flight error message
- **Social layer not exposed as tools** — agent can receive messages but has no `send_message` tool in the builtin set (registry-replication.ts has one, but it's in a registry file, not obvious)
- **Model switching is env-var-only** — DEFAULT_INFERENCE_MODEL and DEFAULT_LOW_COMPUTE_MODEL hardcoded; should be in config JSON and editable via setup
- **Config has 40+ fields** — too many for non-technical users; group into required/optional/advanced tiers in wizard

### 🚀 Should Be Added
- **Web dashboard** — minimal read-only status page (balance, state, recent turns, tool history); agents need a face
- **`sol-agent logs`** CLI command — tail the agent's reasoning/actions in real time
- **`sol-agent fund` CLI command** — generate a QR code / payment link to fund the agent's USDC wallet easily
- **Plugin/tool API** — allow skills to register custom tools, not just inject instructions; this is the #1 extensibility gap
- **Agent marketplace** — standard way for agents to advertise services and accept payment via x402
- **Multi-agent messaging tools** — `send_message` and `read_inbox` as first-class builtin tools (currently social is passive)
- **Child health monitoring** — parent agent should be able to check if children are alive/funded and auto-top-up
- **Reputation system** — ReputationEntry schema exists in DB but nothing writes to it; needs on-chain attestations
- **Deployment guide** — how to run on a VPS, Docker Compose setup, systemd service, cloud options
- **`sol-agent audit`** CLI command — print git log of all self-modifications with diffs, timestamped

---

## Priority Matrix

| Priority | Item | Effort |
|----------|------|--------|
| P0 | Proper README + docs | Low |
| P0 | `sol-agent logs` command | Low |
| P0 | `sol-agent fund` QR command | Low |
| P1 | Plugin tool API for skills | High |
| P1 | Web dashboard (read-only) | Medium |
| P1 | `send_message` / `read_inbox` tools | Low |
| P1 | Heartbeat CLI (`heartbeat add`) | Medium |
| P2 | Agent marketplace | High |
| P2 | Child health monitoring + auto-fund | Medium |
| P2 | Reputation system | High |
| P3 | Deployment guide | Low |
| P3 | Non-Docker fallback mode | High |
