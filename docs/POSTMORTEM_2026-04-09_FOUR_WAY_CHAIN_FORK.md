# Postmortem: Four-Way Chain Fork — 2026-04-09

**Severity:** High — chain consensus broken across all 4 validators  
**Duration:** ~6 hours (discovered at block ~11,700; resolved by coordinated restart)  
**Affected versions:** chain-v1.3.1 through v1.3.10  
**Status:** Root cause under investigation — see [Issue #15](https://github.com/hyperspaceai/agi/issues/15)

---

## Timeline

| Time (UTC) | Event |
|------------|-------|
| ~2026-04-09 00:00 | Chain restart after v1.3.10 deployment |
| 00:00 – 07:45 | 4/4 validators in clean consensus; identical block hashes sampled at blocks 100, 300, 500, …, 11,600 |
| ~07:45 (block ~11,700) | Fork detected — 4 distinct block hashes, one per validator |
| 08:00 | All validators still advancing independently on 4 separate forks |
| 14:00+ (block 18,000+) | Fork persists; no automatic reconciliation |
| ~14:30 | Coordinated restart restores 4/4 consensus |

---

## Observed Behavior

- **Blocks 0–11,600:** All 4 validators produced identical block hashes at every sampled height. The determinism fixes from v1.3.1–v1.3.6 (gas limit, timestamp, coinbase, beacon) were working.
- **Block ~11,700:** Each validator diverged onto its own independent chain. No panics, no process restarts, no auto-updates occurred at that point.
- **Blocks 11,700–18,000+:** Each validator continued producing blocks on its own fork indefinitely. The block-production layer has no fork-choice reconciliation — once diverged, validators stay diverged.

---

## What This Is NOT

Prior to this incident, the following were ruled out as root causes and fixed:

| Fixed in | Issue |
|----------|-------|
| v1.3.1 | Gas limit non-determinism |
| v1.3.2 | Timestamp skew between validators |
| v1.3.3 | Coinbase address ordering |
| v1.3.4 | Beacon randomness divergence |
| v1.3.5–v1.3.6 | Various state-hash determinism gaps |
| v1.3.8 | Emergency-recovery / catch-up 0-cert paths removed |
| v1.3.10 | WaitGroup crash on startup; WaitForSync settle window |

None of these account for a fork that occurs after 8 hours of verified clean consensus.

---

## Likely Root Cause

The timing signature — consistent 8-hour window, clean consensus before and after restart — points to a **timing-dependent cert-gossip divergence** in the Narwhal DAG consensus layer.

### Hypothesis

The Narwhal DAG accumulates per-round certificate counts and support counts. Over ~11,600 blocks (~8 hours), small differences in gossip message delivery timing between validators cause **accumulated skew** in the quorum-support counts for leader rounds.

At some threshold round, one validator's accumulated skew is sufficient to trigger a **view-change vote** that the other three validators haven't received enough support for. Once a single wave is committed differently, the Bullshark BFT ordering layer produces different block sequences, and the fork is permanent (no fork-choice rule exists at the block-production layer to reconcile).

Probable trigger: a **wall-clock-dependent condition** remaining somewhere in the DAG layer (e.g., a timeout computed from `time.Now()` rather than from block height or round number). This would explain why the fork occurs at approximately the same elapsed time after every clean restart.

---

## Investigation Protocol

To confirm or refute the hypothesis, the following data is needed from the next occurrence:

### 1. Enable per-round DAG state logging on all validators

Add structured log output at each Narwhal round commit:

```
[DAG] round=<N> leader=<peer_id> cert_count=<N> support_count=<N> view_change_votes=<N> quorum_threshold=<N> committed=<bool>
```

Compare logs across all 4 validators at rounds 11,500–11,700.

### 2. Diff the cert sequences at the fork boundary

At block ~11,700, capture `getBlock(11699)` and `getBlock(11700)` from all 4 validators via JSON-RPC:

```bash
for port in 8545 8546 8547 8548; do
  curl -s -X POST http://localhost:$port \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["0x2DA2",true],"id":1}' \
    | jq '{port: '$port', hash: .result.hash, parentHash: .result.parentHash}'
done
```

The first block where hashes diverge identifies the exact round.

### 3. Check for remaining wall-clock dependencies

Search the chain binary for any remaining `time.Now()` calls in the DAG/consensus path:

```bash
go tool objdump hyperspace-agentic-blockchain | grep -i "time.Now"
# or in source:
grep -r "time\.Now()" ./network/ ./consensus/ | grep -v "_test.go"
```

Any `time.Now()` in a code path that affects certificate ordering or view-change thresholds is a fork risk.

### 4. Instrument view-change votes

Log every view-change vote received and sent:

```
[BULLSHARK] round=<N> view_change: sent=<bool> received_from=[<peer_ids>] threshold=<N> triggered=<bool>
```

A validator that triggers a view-change the others don't is the fork originator.

---

## Impact

- **Payment economy:** Unaffected — the external RPC endpoint (`rpc.a1.hyper.space:8545`) points to one validator; users and agents interacted with a consistent view.
- **P2P agent layer:** Unaffected — inference, experiments, and training continued normally on all nodes throughout the fork.
- **Block rewards:** Validators on minority forks continued earning rewards on their local chain. Reconciliation after restart determined which rewards were canonical.
- **Miner nodes:** `hyperspace status` showed inconsistent `Sync` state during the fork window.

---

## Mitigation Applied

**Coordinated restart** of all 4 validators at approximately 14:30 UTC restored 4/4 consensus immediately. The chain has been stable since.

---

## Recommended Fixes

### Short-term (before next 8-hour window)

1. **Remove all `time.Now()` from consensus-critical paths** — replace with round-number-based timeouts.
2. **Add view-change logging** (see Investigation Protocol §4) to detect asymmetric view-change votes in production before they cause a fork.

### Medium-term

3. **Add a fork-choice rule** at the block-production layer. Even a simple "longest chain wins" rule would allow validators to self-heal after a transient fork without a coordinated restart.
4. **Automate the post-fork detection** — a GitHub Action that samples `eth_getBlockByNumber` from all validators every 5 minutes and alerts if hashes diverge.

### Long-term

5. **Deterministic message delivery in Narwhal gossip** — use logical clocks (Lamport timestamps) instead of wall-clock timeouts for cert aggregation deadlines, eliminating the timing sensitivity entirely.

---

## References

- [Issue #15](https://github.com/hyperspaceai/agi/issues/15) — ongoing investigation
- Chain releases v1.3.1–v1.3.10: https://github.com/hyperspaceai/agi/releases
- Narwhal consensus paper: https://arxiv.org/abs/2105.11827
- Bullshark BFT: https://arxiv.org/abs/2201.05677
