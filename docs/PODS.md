# Hyperspace Pods

Pool your machines into one AI cluster. Distributed inference, shared providers, always-on agents, and an OpenAI-compatible API — for a family, a startup, or a few friends.

---

## Install the CLI

Pods are built into the Hyperspace CLI. One command to install on macOS or Linux:

```bash
curl -fsSL https://agents.hyper.space/api/install | bash
```

The installer auto-detects your GPU, downloads the best model for your hardware, and starts the daemon. After install, verify:

```bash
hyperspace --version
hyperspace status
```

To update to the latest version, run the install command again.

---

## What are Pods

A **Pod** is a private compute cluster. Members join with the CLI, and their machines form a mesh. Models are served across the mesh — a query routes to whichever node has the best model loaded. Every pod gets:

- **Distributed inference** — shard large models across multiple machines. A 32B model can run across two 16 GB laptops.
- **Shared providers** — pool OpenRouter, Groq, Together, or any cloud API key with per-member budgets.
- **OpenAI-compatible API** — every pod gets a `pk_*` key that works with any OpenAI SDK client.
- **Always-on agent VM** — deploy a pod daemon across 9 cloud providers.
- **Drive** — shared filesystem with vector search for RAG.
- **Custom domains** — every pod gets `<slug>.hyperspace.sh` with dashboard, files, apps, and webhooks.

### Two modes

| Mode | How it works | Requirements |
|---|---|---|
| **Local** (default) | Raft-backed consensus, no server required, fully offline. Uses your node's Ed25519 identity. | None |
| **Cloud** (`--cloud`) | Backed by Supabase via the Thor API. Enables web UI, Drive, connectors, VM provisioning, and the inference marketplace. | `hyperspace login` |

---

## Quick start

### Create a pod

```bash
hyperspace pod create "my-lab"
```

Creates a local pod using Raft consensus. For a cloud-backed pod with web UI:

```bash
hyperspace login
hyperspace pod create "my-lab" --cloud
```

Flags: `--plan` (starter|team|business|enterprise), `--description`, `--raft-port`, `--http-port`

### Invite members

```bash
hyperspace pod invite
# → Invite code: hp_inv_abc123...
# → Share link:  https://hyper.space/join/abc123
```

Options:

```bash
hyperspace pod invite --role admin      # admin permissions
hyperspace pod invite --ttl 2d          # expires in 2 days
hyperspace pod invite --multi-use       # reusable invite
```

### Join a pod

```bash
hyperspace pod join hp_inv_abc123
```

Or click the share link — it opens the magic invite landing page.

### Check status

```bash
hyperspace pod status
```

Shows online nodes, total VRAM, available models, treasury balance, and active API keys.

### Use the pod

```bash
# OpenAI-compatible API — works with any SDK
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer pk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-32b",
    "messages": [{"role":"user","content":"Hello from the pod"}]
  }'
```

---

## Command reference

### Core commands

| Command | Description |
|---|---|
| `hyperspace pod create <name>` | Create a new pod |
| `hyperspace pod join <invite-code>` | Join an existing pod |
| `hyperspace pod leave` | Leave the current pod |
| `hyperspace pod status` | Show pod status + online nodes |
| `hyperspace pod members` | List members with roles + online status |
| `hyperspace pod invite` | Generate a shareable invite token |
| `hyperspace pod models` | List models available across the mesh |
| `hyperspace pod resources` | Per-node breakdown (VRAM, CPU, models) |
| `hyperspace pod keys create` | Mint a new OpenAI-compatible API key |
| `hyperspace pod keys list` | List all pod API keys with usage |
| `hyperspace pod shard <model>` | Activate distributed inference |
| `hyperspace pod providers` | List configured cloud providers |
| `hyperspace pod budgets` | Show per-member spend limits |
| `hyperspace pod usage` | Current usage + cost breakdown |

### Coordinator commands (local mode / Raft)

| Command | Description |
|---|---|
| `hyperspace pod coord status` | Cluster health, leader, Raft state |
| `hyperspace pod coord members` | Members with roles |
| `hyperspace pod coord balance <id>` | Treasury balance for member |
| `hyperspace pod coord ledger` | Full treasury audit trail |
| `hyperspace pod coord mint <name>` | Mint a `pk_*` API key |
| `hyperspace pod coord revoke <key_id>` | Revoke an API key |
| `hyperspace pod coord transfer <to> <amount>` | Transfer credits between members |
| `hyperspace pod coord credit <to> <amount>` | Admin credit to treasury |
| `hyperspace pod coord invite` | Issue a membership token |
| `hyperspace pod coord redeem <token>` | Redeem a membership token |
| `hyperspace pod coord join-cluster` | Add a Raft voter (leader only) |

All commands support `--json` for structured output (used by MCP / Claude Code).

---

## Distributed inference

Pods form an inference mesh. When a request arrives, the gateway routes it to the best available node based on model, VRAM, and load.

### Model sharding

For models too large for any single node, shard them across the pod:

```bash
hyperspace pod shard qwen3.5-32b
```

The CLI auto-detects the best shard plan based on available VRAM across pod nodes. Transformer layers are split proportionally — e.g. a 32B model across two 16 GB machines puts ~half the layers on each.

Shard communication uses three libp2p protocols:

| Protocol | Purpose |
|---|---|
| `/hyperspace/shard-activation/1.0.0` | Stream binary activations between layers |
| `/hyperspace/shard-request/1.0.0` | Receive inference requests for assigned layers |
| `/hyperspace/shard-token/1.0.0` | Tail shard streams tokens back to head |

Local inference backends: Ollama, llama-server, or native engines. The CLI auto-pulls models from Ollama (fastest), HuggingFace GGUF (auto-selects Q4_K_M), or direct URL.

### Smart routing

The gateway evaluates providers in priority order:

1. **Pod-distributed** — local shards across the mesh
2. **Pod-peer** — federated pods via alliances
3. **Cloud-BYOK** — admin's own API keys
4. **Cloud-funded** — platform keys, charges pod treasury

Budget enforcement happens at every level — member daily/monthly limits, per-key spend caps, provider credential caps, and pod treasury balance.

---

## Provider management

Pod admins configure cloud providers so members can access models the pod doesn't run locally.

```bash
hyperspace pod providers
```

Supported providers: OpenRouter, Groq, Together, Fireworks, DeepInfra, xAI, Google, Mistral, Cohere, Anthropic, OpenAI, Vercel AI Gateway.

Two modes per provider:

| Mode | How it works |
|---|---|
| **BYOK** | Admin pastes their own API key (encrypted with AES-256-GCM at rest). No platform markup. |
| **Funded** | Platform uses its own keys and charges the pod treasury with an optional markup (0–100%). |

Per-credential caps: `monthly_cap_cents` and `one_time_cap_cents`. Credentials auto-disable when caps are hit.

---

## Member budgets

```bash
hyperspace pod budgets
```

Four budget modes per member:

| Mode | How it works |
|---|---|
| `percent` | Basis points of pod treasury (e.g. 2500 = 25%) |
| `fixed_daily` | Hard cap in cents per day |
| `fixed_monthly` | Hard cap in cents per month |
| `unlimited` | No limit (admin trust) |

Before every inference request, the gateway calls `check_and_reserve_budget()` atomically — if the member is over budget, the request is rejected before it hits any provider.

---

## API keys

```bash
# Mint a new key
hyperspace pod keys create --name "dev-key" --scopes inference,embed
# → pk_abc123def456...
```

Use with any OpenAI SDK:

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="pk_abc123def456..."
)

response = client.chat.completions.create(
    model="qwen3.5-32b",
    messages=[{"role": "user", "content": "Hello from pods"}]
)
print(response.choices[0].message.content)
```

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:8080/v1',
  apiKey: 'pk_abc123def456...',
});

const response = await client.chat.completions.create({
  model: 'qwen3.5-32b',
  messages: [{ role: 'user', content: 'Hello from pods' }],
});
console.log(response.choices[0].message.content);
```

Key features:

- Rate limiting per key (default 60 RPM)
- Daily/monthly spend limits per key
- Model allowlist (default: all pod models)
- Usage tracking: request count, tokens, cost
- `allow_public_overflow` — fall back to the public Hyperspace network when the pod is at capacity

```bash
# List all keys with usage
hyperspace pod keys list
```

---

## Pod Drive

Every pod gets a shared filesystem with automatic text extraction and vector embeddings for RAG.

- **Storage backend** — S3-compatible (R2 / S3 / GCS) or local filesystem fallback
- **Text extraction** — PDF (pdf-parse), Word (mammoth), and plain text
- **Embeddings** — chunk-level vectors via GTE-384, Ollama-768, or OpenAI-1536
- **Search** — cosine similarity across all indexed documents

Storage scales with your plan tier.

---

## Pod VM — always-on agents

Deploy an always-on agent daemon on a cloud VM. The daemon runs heartbeat, cron jobs, Rail event subscriptions, webhook handlers, and Drive indexing.

Supported VM providers: **Oracle Cloud (Free Tier — $0)**, Scaleway, Fly.io, Vercel, Vultr, Lightsail, DigitalOcean, Linode, Hetzner.

BYOK model — you provide your cloud provider API token (encrypted at rest with AES-256-GCM). Hyperspace auto-provisions the cheapest instance in the closest region.

### Scheduled jobs

The daemon executes jobs defined in `pod_agent_jobs`:

| Kind | Description |
|---|---|
| `cron` | Run `hyperspace run "..."` on a schedule |
| `webhook` | HMAC-verified incoming webhooks (Slack, GitHub, Stripe, Twilio, generic) |
| `rail-subscribe` | Subscribe to Rail event bus (SSE) |
| `drive-index` | Background vectorization of new documents |

### Webhook HMAC verification

Incoming webhooks are verified with `crypto.timingSafeEqual` using the pod's invite secret. Supported webhook formats: generic, Slack, GitHub, Stripe, Twilio — each parsed with their native signature scheme.

---

## Services (apps)

Deploy user apps inside the pod under `<slug>.hyperspace.sh/apps/<name>/*`.

| Runtime | How it starts |
|---|---|
| `python` | `python -m venv` + `pip install` + `python server.py` |
| `node` | `npm install` + `node index.js` |
| `docker` | `docker build` + `docker run` |
| `shell` | Direct shell command |
| `static` | `python -m http.server` on static files |

Source hydration: `git` (clone + branch), `tarball` (download + extract), or `inline` (files defined in JSON). Entrypoint: configurable script filename. Environment variables: JSONB map.

Services are managed by systemd units — crash recovery, liveness tracking, public/private flag.

---

## Connectors

Sync external data sources into Pod Drive. Each connector binds to an OAuth credential and polls on a schedule (default: every 60 minutes).

| Provider | Config |
|---|---|
| Google Drive | `folderId` — sync a folder + subfolders |
| Dropbox | `path` — sync a directory tree |
| Notion | `databaseId` — export Workspace pages as markdown/CSV |

Incremental sync via delta cursors — only fetches changes since last sync. Full audit trail in `pod_connector_sync_log`.

---

## Custom domains

Every pod automatically gets `<slug>.hyperspace.sh` routed by a Cloudflare Worker with KV cache.

URL layout:

| Path | What it serves |
|---|---|
| `/` | Pod dashboard |
| `/files` | Drive file browser |
| `/apps/<name>` | User-deployed service proxy |
| `/webhook/<path>` | HMAC-verified webhook endpoint |
| `/agents/*` | Proxied to Thor agent runtime |

**BYOD** — bring your own domain via CNAME + TXT verification. Point your CNAME at `<slug>.hyperspace.sh` and add the TXT challenge record.

---

## Templates

Agent templates are reusable recipes installable into any pod. 10 seeded recipes ship out of the box (autoresearch, autosearcher, autoweb, autoquant, autorl, autoastrophysicist, and more). Users can create, fork, star, and publish their own.

Visibility: `public` (listed in catalog), `unlisted` (link-only), or `private`. Fork lineage tracked via `forked_from_id`.

---

## Federation & alliances

Pods can form alliances — peer-to-peer trust relationships that share models, credit pools, or both.

- **Pod alliances** — bilateral trust with configurable duration (default 24h). Share model lists, optional shared credit pool.
- **Public offerings** — a pod advertises model access to other pods at a per-request rate. Revenue tracked automatically.
- **GPU rental** — members list GPU hours at a price. Other pods can rent them for batch jobs.
- **Skill marketplace** — publish skills with pricing. Purchases tracked buyer-to-seller.
- **Ed25519 federation** — signed envelopes with 5-min TTL, per-user trust model. Inbound runs execute as peer-owner's user.

---

## Using with Claude Code

The Hyperspace CLI exposes itself as an MCP server. Claude Code can manage your pod, run inference, and control your cluster directly.

### Setup

Add Hyperspace as an MCP server in your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "hyperspace": {
      "command": "hyperspace",
      "args": ["mcp"]
    }
  }
}
```

Once connected, Claude Code can call any pod command as a tool — create pods, invite members, check status, mint API keys, shard models, and more.

### Example prompts

```
"Create a pod called research-lab and invite my teammate"
"What models are available in my pod?"
"Shard qwen3.5-32b across the pod"
"Mint an API key for the frontend app"
"Show me pod usage for this month"
```

### Using the pod as an inference backend

Once your pod is running with a model, point any tool or script at the pod's OpenAI-compatible API:

```bash
# Environment variables for any OpenAI SDK client:
export OPENAI_BASE_URL="http://localhost:8080/v1"
export OPENAI_API_KEY="pk_your_pod_key"

# Now any tool that uses the OpenAI SDK talks to your pod.
# This includes aider, continue, cursor, or custom scripts.
```

### JSON output mode

All pod commands support `--json` for structured output, which MCP tools use internally:

```bash
hyperspace pod status --json
hyperspace pod members --json
hyperspace pod invite --json
```

### Device linking

Link your CLI to your Hyperspace account so the web UI can send commands to your machine:

```bash
hyperspace login
# CLI heartbeats to your account + polls for remote commands.
# The web UI at /me shows your linked devices and their status.
```

Remote commands from the website to your CLI: install model, unload model, restart, shard model, pull URL. All queued with 1-hour TTL.

---

## Pod Capsule — portable state

Export your entire pod as a single encrypted file for migration or backup:

```bash
# Export
hyperspace pod capsule export --passphrase "..."
# → my-lab.capsule.tar.gz (PBKDF2 + AES-256-GCM)

# Import on another machine or self-host
hyperspace pod capsule import my-lab.capsule.tar.gz
# or:
docker compose up  # self-host the full pod
```

The capsule contains vault, provider credentials, Drive files, job configs, settings, and member list. Passphrase-encrypted, portable across providers.

---

## Links

- **Changelog**: [changelog.hyper.space](https://changelog.hyper.space)
- **Network**: [agents.hyper.space](https://agents.hyper.space)
- **CLI Install**: `curl -fsSL https://agents.hyper.space/api/install | bash`
- **Twitter**: [@HyperspaceAI](https://x.com/HyperspaceAI) · [@varun_mathur](https://x.com/varun_mathur)
