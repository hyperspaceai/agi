# Sidecar Crash Recovery

> Use this runbook for the **`SidecarConfig required for NetworkNodeAdapter.start()`**
> crash that follows a network disconnect (issue [#17](https://github.com/hyperspaceai/agi/issues/17)).
> This is a known bug; this runbook is the workaround until a fixed CLI version ships.

---

## Symptoms

After a network blip (peer timeout, transient connectivity loss, sleep/wake
on a laptop), the CLI dies with:

```
Fatal error: Error: SidecarConfig required for NetworkNodeAdapter.start()
    at NetworkNodeAdapter.start (.../sea-bundle.cjs:...)
    at HyperspaceCLI.handleReconnect (.../sea-bundle.cjs:...)
```

The process exits and is restarted by your service supervisor (systemd,
launchd, supervisor) or by the install script's auto-restart loop.

After ~30-60 seconds (the next disconnect event), it crashes again. You
are in a **crash loop with progress** — the node briefly works between
crashes, but never stably enough to mine, train, or earn full Pulse points.

---

## Diagnosis

Confirm it is this issue and not a different sidecar problem:

```bash
# 1. Check the most recent crash
journalctl -u hyperspace --since "10 minutes ago" \
  | grep -E "SidecarConfig|NetworkNodeAdapter|reconnect"

# Expected output snippet:
# Fatal error: Error: SidecarConfig required for NetworkNodeAdapter.start()

# 2. Confirm it follows a disconnect
journalctl -u hyperspace --since "30 minutes ago" \
  | grep -E "(Peer disconnected|All peers disconnected|reconnect)"

# Expected: a "disconnect" or "all peers" event ~1-3s before the crash
```

If both grep commands return matching evidence, this is the bug.

---

## Recovery — temporary workaround

There are two workarounds. Pick the one that fits your hardware.

### Workaround A — disable sidecar, accept periodic crash cycles

```bash
# Stop the running CLI
sudo systemctl stop hyperspace

# Edit the systemd unit (or your launcher) to set:
sudo systemctl edit hyperspace
```

Add (or set in the override file):

```
[Service]
Environment="HYPERSPACE_NETWORK_SIDECAR=0"
Restart=always
RestartSec=15s
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl start hyperspace
```

This puts networking in-process. The trade-off is that gradient uploads
during distributed training will block the libp2p event loop, causing
heartbeat timeouts every ~10 minutes and a clean process restart. The
service supervisor restarts you automatically.

**This workaround is appropriate for nodes that are not actively training**
(observation-only nodes, search-engine nodes, finance-only nodes). For
miner / training nodes, use Workaround B.

### Workaround B — restart sidecar on disconnect using a watchdog

If you cannot tolerate the 10-minute restart cycle of Workaround A, run a
watchdog that restarts the entire `hyperspace` process on disconnect
*before* the sidecar reconnect bug fires:

`/etc/hyperspace/watchdog.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
LOG=/var/log/hyperspace/main.log
TAIL_PID=
trap 'kill $TAIL_PID 2>/dev/null || true' EXIT

tail -F -n 0 "$LOG" | while read -r line; do
  if grep -qE "All peers disconnected|Peer count [01] < 3" <<< "$line"; then
    echo "[watchdog] disconnect detected — restarting hyperspace before sidecar bug fires"
    sudo systemctl restart hyperspace
    sleep 30  # debounce
  fi
done &
TAIL_PID=$!
wait
```

Make it executable and run as a separate systemd unit. The cost is one
clean restart per disconnect event (instead of one crash + one restart),
which is faster than the crash path and usually invisible.

---

## Verification

```bash
# Watch logs for 10 minutes after applying the workaround
journalctl -u hyperspace -f --since "now"

# Expected (Workaround A):
# - Periodic restarts every ~10 minutes due to heartbeat timeout
# - NO "SidecarConfig required" errors

# Expected (Workaround B):
# - Restart triggered by watchdog on disconnect, completes in <30s
# - NO "SidecarConfig required" errors
```

In `hyperspace status`, you should see Pulse rounds incrementing instead
of staying at 0. That is the most reliable signal that the workaround is
working: an actual research/proof cycle completed without a crash.

---

## Prevention — what is the actual fix

The bug is a missing argument on the reconnect path. The fix is in the
CLI source (TypeScript), not in operator configuration:

```typescript
// Buggy (today)
async handleReconnect() {
  await this.node.start();   // ← missing sidecarConfig
}

// Fixed
async handleReconnect() {
  await this.node.start(this.sidecarConfig);
}
```

See [issue #17](https://github.com/hyperspaceai/agi/issues/17) for the
two proposed patches (Option A: cache sidecarConfig at first start;
Option B: pass it as a constructor argument).

Once a CLI version with the fix is released, **remove
`HYPERSPACE_NETWORK_SIDECAR=0` and the watchdog**, both of which were
workarounds, not solutions. Verify by running normally for 24 hours
without crashes.

---

## Related runbooks

- [chain-fork-recovery.md](chain-fork-recovery.md) — for chain-level (not CLI-level) instability.
- [full-node-bootstrap.md](full-node-bootstrap.md) — if the workaround left your node in an inconsistent state and you want to start clean.
