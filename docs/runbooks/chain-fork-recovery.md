# Chain Fork Recovery

> Use this runbook when the chain has split into two or more forks and
> validators are advancing independently on different histories.
> Reference incident: [#15](https://github.com/hyperspaceai/agi/issues/15).
> Detailed postmortem: `docs/POSTMORTEM_2026-04-09_FOUR_WAY_CHAIN_FORK.md`
> (lands with the related operational PR).

---

## Symptoms

- `hyperspace status` shows `Sync: unknown` or oscillates between values.
- The leaderboard / snapshot is showing inconsistent block heights across nodes.
- External RPC (`rpc.a1.hyper.space:8545`) and a local validator return
  **different block hashes for the same block height**.

The defining test:

```bash
# From any machine, query 4 validators (replace endpoints with your validator set)
for ep in https://val1.a1.hyper.space:8545 https://val2.a1.hyper.space:8545 https://val3.a1.hyper.space:8545 https://val4.a1.hyper.space:8545; do
  H=$(curl -sf -X POST "$ep" \
        -H 'Content-Type: application/json' \
        -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
        | jq -r '.result' || echo "DOWN")
  if [ "$H" = "DOWN" ]; then
    echo "$ep  DOWN"
    continue
  fi
  HASH=$(curl -sf -X POST "$ep" \
        -H 'Content-Type: application/json' \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBlockByNumber\",\"params\":[\"$H\",false],\"id\":1}" \
        | jq -r '.result.hash')
  echo "$ep  $H  $HASH"
done
```

If you see >1 distinct hash at the same height, you have a fork.

---

## Diagnosis

Confirm it is a true fork (not a transient propagation lag):

1. Wait 60 seconds and re-run the query above. Transient lag resolves itself.
2. Sample at heights `H`, `H-100`, `H-1000`. Hashes should diverge starting at one specific height — that is the fork point.
3. Check `hyperspace logs --component chain` on each validator for panics, restarts, or unrecoverable errors. If any validator restarted in the last hour, this may be a startup-determinism bug, not a steady-state fork.

If divergence is consistent across multiple samples spanning >5 minutes, **it is a fork**.

---

## Recovery

The current authoritative recovery is a **coordinated restart** of all
validators. This is **destructive of fork state** but does not lose
external transactions (those replay from the mempool).

> ⚠️ This procedure should be coordinated by the network maintainers via
> the operators' channel. Do not unilaterally restart validators on a
> production network.

### Step 1 — Coordinate

Announce in the operators' channel:

```
[FORK-RECOVERY] Coordinated validator restart in 5 minutes.
Validators: <list>. Target: snapshot at block H (last common ancestor).
Stop signal: STOP at T+5m. Resume signal: START at T+10m.
```

### Step 2 — Identify last common ancestor

```bash
# Find the highest block height where all validators agree on the hash.
# Run from a machine with access to all validator RPCs.
node tools/find-common-ancestor.js \
  https://val1:8545 https://val2:8545 https://val3:8545 https://val4:8545
# Output: { commonAncestor: <height>, divergedAt: <height+1> }
```

> The `tools/find-common-ancestor.js` script is not yet shipped — see the
> "Prevention" section. Until it ships, do this manually with `eth_getBlockByNumber` queries.

### Step 3 — Halt all validators

On each validator, simultaneously:

```bash
sudo systemctl stop hyperspace-chain
# Verify stopped
sudo systemctl status hyperspace-chain
```

### Step 4 — Snapshot to last common ancestor

On each validator:

```bash
hyperspace chain snapshot create --to-height <commonAncestor> \
  --out /var/backups/hyperspace/pre-fork-restart-$(date +%s).snap
```

If snapshotting is unavailable, skip — Step 5 will resync from peers.

### Step 5 — Restart all validators within 60 seconds

On each validator:

```bash
sudo systemctl start hyperspace-chain
hyperspace status --watch
```

### Step 6 — Wait for re-convergence

Watch the block height and hash on all validators. Within ~5-15 minutes
(depending on fork depth), all validators should converge on a single
chain history.

---

## Verification

Re-run the divergence check from §Symptoms. Expected: all RPCs return
the same hash at the same height for ≥10 consecutive samples spanning
≥5 minutes.

```bash
# Sanity check: snapshot count restored to single value
curl -s https://rpc.a1.hyper.space:8545 -X POST \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

---

## Prevention

Fork recurrence indicates a deterministic-divergence bug in the chain
binary. **Do not just restart and move on.** When a fork happens:

1. Save the chain logs from all validators (`/var/log/hyperspace-chain/*`)
   spanning at least the hour before the fork point.
2. Save the per-validator state at the fork height.
3. File or update an issue (e.g. #15) with:
   - The fork height
   - Block hash divergence at fork+1
   - Chain binary version
   - Anything unusual in the logs near the fork point

The investigation protocol from
`docs/POSTMORTEM_2026-04-09_FOUR_WAY_CHAIN_FORK.md` applies (lands with
the related operational PR).

### Tooling improvements wanted

- `tools/find-common-ancestor.js` — automated ancestor detection.
- A pre-restart snapshot workflow that runs across all validators with one command.
- A GitHub Action that polls validator RPCs every 5 minutes and alerts the operators' channel on divergence — fork detection should not depend on someone noticing manually.

If you write any of these, link the PR here.
