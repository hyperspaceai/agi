# Full Node Bootstrap

> Use this runbook to set up a Hyperspace full node from scratch on
> Linux x86_64 or aarch64. Adapted forms apply to macOS and Windows; the
> core sequence (install → wallet → start → join → verify) is the same.

---

## Prerequisites

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| OS | Linux x86_64 or aarch64, kernel ≥ 5.15 | Ubuntu 22.04 / 24.04 |
| RAM | 8 GB | 32 GB |
| Disk | 50 GB SSD | 200 GB NVMe |
| GPU | none (CPU-only works for full node, not for miner) | RTX 3060+ for miner role |
| Network | 25 Mbps symmetric | 100+ Mbps, IPv4 + IPv6 |
| Open ports | 30301 (chain P2P), 30302 (Hydra TX inlet), 4001 (libp2p), 8545 (RPC, optional) | same |

You do NOT need root access — Hyperspace installs to `~/.hyperspace`. You
will need passwordless `sudo` only if you want to run as a systemd service.

---

## Step 1 — Install

```bash
curl -fsSL https://agents.hyper.space/api/install | bash
```

The installer:

1. Downloads platform-appropriate binaries (CLI + chain + sidecar).
2. Verifies SHA-256 checksums against the published manifest.
3. Writes binaries under `~/.hyperspace/bin/`.
4. Adds `~/.hyperspace/bin` to your shell `PATH` if missing.
5. Generates a default `~/.hyperspace/config.toml`.

After the installer completes:

```bash
hyperspace --version
# Expected: vX.Y.Z (the latest release)
```

If `hyperspace` is not on PATH, source the installer's PATH addition:

```bash
source ~/.hyperspace/env
```

---

## Step 2 — Generate or import a wallet

A wallet is required for chain-role nodes (mining, validating). It is
optional for observe-only nodes but recommended.

```bash
# New wallet
hyperspace wallet create

# OR import existing
hyperspace wallet import --keyfile ./my-key.json
```

The wallet is encrypted at rest with a passphrase. **Save the passphrase
in a separate secure store.** Loss of the passphrase = loss of the wallet.

```bash
# Verify
hyperspace wallet show
# Expected:
#   Address:  0x...
#   Balance:  0.0 HSP
```

If you see `Wallet unavailable — install ethers`, you are hitting issue
[#11](https://github.com/hyperspaceai/agi/issues/11). Either run from
source (`npm install` first) or wait for a fixed SEA build.

---

## Step 3 — Configure role

Edit `~/.hyperspace/config.toml`:

```toml
[node]
role = "fullnode"          # or: miner, router, relay
log_level = "info"

[chain]
chain_id = 808080
data_dir = "/var/lib/hyperspace/chain"   # or ~/.hyperspace/chain
bootnodes_file = "auto"                  # discovers from agents.hyper.space

[network]
listen = ["/ip4/0.0.0.0/tcp/4001", "/ip4/0.0.0.0/udp/4001/quic-v1"]
public_ip = "auto"                       # uses STUN/UPnP

[telemetry]
publish_to_snapshots = true              # contributes to network/snapshots branch
```

Roles:

| Role | What it does | Earns |
|------|--------------|-------|
| `fullnode` | Validates blocks, serves RPC, gossips | Presence points only |
| `miner` | Produces blocks, runs research experiments | Presence + Work points |
| `router` | Routes Hydra DHT, handles payment channels | Routing fees |
| `relay` | NAT traversal for peers behind firewalls | Relay fees (small) |

---

## Step 4 — Start

### Foreground (for first-time validation)

```bash
hyperspace start
```

You should see:

```
[INFO] Starting hyperspace v5.39.6 (role=fullnode, chain_id=808080)
[INFO] Bootstrapping libp2p host (peer_id=12D3Koo...)
[INFO] Connecting to 6 bootnodes
[INFO] Chain: syncing from height 0 ...
[INFO] Chain: synced to head (height=234567)
[INFO] Pulse: ready
[INFO] Status: HEALTHY
```

If sync stalls, see [chain-fork-recovery.md](chain-fork-recovery.md) §Diagnosis.

Stop with Ctrl-C.

### Background (production)

Create `/etc/systemd/system/hyperspace.service`:

```ini
[Unit]
Description=Hyperspace Node
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=hyperspace
WorkingDirectory=/home/hyperspace
ExecStart=/home/hyperspace/.hyperspace/bin/hyperspace start
Restart=always
RestartSec=15s
LimitNOFILE=65536
Environment="HYPERSPACE_NETWORK_SIDECAR=1"

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hyperspace
sudo journalctl -u hyperspace -f
```

---

## Step 5 — Verify

```bash
hyperspace status
```

Expected:

```
─ NODE ────────────────────────────────────
  Role:        fullnode
  Peer ID:     12D3Koo...
  Uptime:      0d 0h 5m

─ CHAIN ───────────────────────────────────
  Chain ID:    808080
  Head:        234567 (0xabc...)
  Sync:        in sync (lag: 0 blocks)

─ NETWORK ─────────────────────────────────
  Peers:       42 (target: 50)
  Pulse:       round 1773  ✓
  Gossip:      healthy

─ STATUS ──────────────────────────────────
  Health:      HEALTHY
  Last error:  none
```

If any of these are wrong:

| Symptom | Look here |
|---------|-----------|
| Sync stuck | [chain-fork-recovery.md](chain-fork-recovery.md) §Diagnosis |
| `SidecarConfig required` errors | [sidecar-crash-recovery.md](sidecar-crash-recovery.md) |
| `Wallet unavailable` | issue [#11](https://github.com/hyperspaceai/agi/issues/11) |
| `Pulse: 0 rounds` | issue [#13](https://github.com/hyperspaceai/agi/issues/13) (WASM bundling) |
| Peers stuck below 3 | Check NAT/firewall on ports 4001 and 30301 |

---

## Step 6 — Optional: enable a research role

If you want this node to contribute experiments, not just validate:

```bash
hyperspace research enable --projects financial-analysis,search-engine
hyperspace research status
```

The node will start sampling experiments from the curriculum DAG (see
[VISION.md §Transformation 2](../VISION.md)) and publishing results
under your peer ID's branch in this repo.

---

## Recovering from total state loss

If the chain data directory is corrupted or you need to start completely
fresh:

```bash
sudo systemctl stop hyperspace
mv /var/lib/hyperspace/chain /var/lib/hyperspace/chain.broken-$(date +%s)
sudo systemctl start hyperspace
# Resyncs from peers; takes 1-4 hours depending on chain length.
```

The wallet (`~/.hyperspace/wallet.json`) is independent of the chain
data — wallet recovery does not require chain resync.

---

## Related runbooks

- [chain-fork-recovery.md](chain-fork-recovery.md) — when validators diverge.
- [sidecar-crash-recovery.md](sidecar-crash-recovery.md) — for the sidecar reconnect bug.
