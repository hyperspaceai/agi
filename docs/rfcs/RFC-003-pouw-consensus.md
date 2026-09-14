# RFC-003: Proof-of-Useful-Work Consensus

| Field | Value |
|-------|-------|
| **Status** | Draft |
| **Created** | 2026-05-07 |
| **Depends on** | RFC-001 (Verifiable Research), RFC-002 (Curriculum DAG) |
| **Blocks** | — |

---

## Summary

Replace the chain's current Narwhal/Bullshark-based block production with
**Proof-of-Useful-Work (PoUW)**: every committed block must carry a
freshly-generated, verifiable research receipt whose measured `delta`
(improvement over the previous network best on that project) exceeds a
chain-wide difficulty threshold.

Mining and research become the same operation. The chain's instability
problem and the network's economic-alignment problem are solved by the
same primitive.

## Motivation

### Two unsolved problems with one shape

1. **Chain instability.** The current consensus design has produced
   repeated forks under steady-state load (Issue #15: a four-way fork
   after 8 hours of clean operation; Issue #18: data races in the Go
   sync layer). The chain layer is consuming engineering effort
   disproportionate to its actual contribution to the network's mission
   — research.

2. **Economic misalignment.** Today, points and rewards correlate with
   uptime (Presence Points) and raw compute (Work Points). They do not
   correlate with **research quality**. A node that runs 24/7 but
   produces no research progress earns more than a node that runs 4
   hours/day and discovers a breakthrough. This is upside-down: the
   network's purpose is research, not uptime, but its economy rewards
   the latter.

Both problems share a structure: **the chain layer and the research
layer are decoupled.** Anything that decouples them — separate consensus,
separate rewards, separate workloads — creates surface area for both bugs
and misalignment. The only durable solution is to fuse them.

### Mining as research

In Bitcoin, mining is solving a hash puzzle whose only purpose is
sybil-resistance. Solving the puzzle is wasted from any other perspective.
At Hyperspace's scale (~700 nodes today, projected 10K+), the same wasted
compute could instead train models, evaluate experiments, and verify
proofs.

PoUW makes the mining puzzle **be** a research contribution:

```
Block validity rule:
  block.researchReceipt MUST be:
    1. Schema-conformant per RFC-001
    2. Cryptographically verifiable per its declared proof level
    3. Have block.researchReceipt.result.delta > chain.difficulty
    4. Reference a prior block's receipt as parent (lineage chain)
    5. Be unique on this fork (no replay)
```

The miner who first produces a receipt satisfying these constraints
wins the block. Their reward is proportional to the receipt's delta and
to its position in the curriculum DAG (deeper = harder = more reward).

## Design

### Block structure

```
Block {
  header: {
    height: u64,
    parentHash: hash,
    timestamp: u64,
    receiptHash: hash,        // = sha256(receipt.canonical_body)
    chainState: hash          // post-state root
  },
  receipt: ResearchReceipt,   // RFC-001 receipt; THE proof of work
  txs: [Transaction]          // payments, agent registrations, etc.
                              // (gas pays for inclusion as today)
}
```

The receipt is part of the block. The block's hash binds the receipt's
content. There is no "mining hash puzzle" separate from the receipt —
**the receipt IS the puzzle, and producing it IS the work.**

### Difficulty

Chain difficulty is a per-project parameter:

```
difficulty(project, height) =
    network_best_delta(project, last_N_blocks) × adjustment_factor(height)
```

The adjustment factor targets a constant block time (e.g., 60 seconds
network-wide). If blocks are landing too fast, difficulty rises; too
slow, falls. This is the same negative-feedback loop as Bitcoin, applied
to research deltas instead of hash counts.

Per-project difficulty (rather than a single global value) is critical:
projects mature at different rates, and a global difficulty would lock
mature projects out of mining (no agent can match the historical best
on `financial-analysis` at every block) while making new projects
trivial. With per-project difficulty, each project maintains a healthy
"frontier of contribution."

### Block reward

```
reward(block) =
    base_reward
  × delta_factor(receipt.result.delta / difficulty)
  × curriculum_factor(receipt.project.curriculum_depth)
  × proof_factor(receipt.proof.level)
```

- `delta_factor`: rewards exceeding-difficulty more than just-meeting,
  but with diminishing returns (square-root or log).
- `curriculum_factor`: receipts at curriculum depth `d` earn `d^k`
  multiplier (k ≈ 1.2 to start) — deeper work is harder and worth more.
- `proof_factor`: stronger proofs earn more (zk-groth16 > replay >
  signed). This pays for the extra cost of producing strong proofs.

Total emission is bounded by an asymptote (similar to Bitcoin's halving)
to prevent unbounded inflation, and the chain treasury reserves a
fraction for protocol-level grants (project authors, infrastructure
maintainers).

### Forks and the longest-chain rule

Forks are resolved by **cumulative useful-work**, not block count:

```
chain_weight(chain) = Σ (receipt.result.delta_normalized) for each block
```

The fork with greater cumulative normalized delta wins. This makes
adversarial forking exponentially harder: an attacker would need to
produce more verified research progress than the entire honest network,
not just more compute.

Note that this also means a fork that contains *more total useful research*
is honestly preferred — there is no "honest cumulative work" minus
"adversarial cumulative work" because all work is by definition useful
(it improves at least one project's metric).

### Sybil resistance

The chain inherits Sybil resistance from RFC-001: receipts at level
`zk-groth16` (or stronger) cannot be faked by a Sybil cluster regardless
of how many node identities it controls. Spinning up 1000 fake nodes
does not increase the rate of receipt production — receipt production
is bounded by *actual research progress*, not by node count.

This is a stronger guarantee than PoS (which is bounded by stake) or
PoW (bounded by hash rate). PoUW is bounded by *useful intelligence
production*, which is the metric the network actually wants to reward.

### Validators and verification

A "validator" in PoUW is any peer that:

1. Maintains a copy of the chain.
2. Verifies each block's receipt per RFC-001 §Validation algorithm.
3. Optionally produces blocks themselves.

There is no separate validator role. Any agent producing receipts can
include them in candidate blocks. Verification cost is the dominant
operational cost (proof verification + parent receipt lookup), not
block production.

### Light clients

Light clients verify the chain by checking only the proof of each
block's receipt — they do not re-run the experiments. This is
efficient: zk-groth16 verification is sub-100ms per block, tens of
thousands of blocks per minute on commodity hardware.

The chain's security guarantee for light clients is therefore identical
to its security guarantee for full validators: forging a chain requires
forging a sequence of receipts, which the light client verifies in
constant time per block.

## Migration

PoUW is the highest-risk transformation in this roadmap. The migration
plan is conservative.

### Phase A — Shadow chain (months 0-6)

Run a parallel PoUW chain alongside the existing Narwhal/Bullshark
chain. Both produce blocks. The PoUW chain is read-only — its blocks
are not used for payments or for the on-chain state. Validators on the
existing chain optionally run PoUW for testing.

Goal: confirm block-time stability, validate reward parameters, find
failure modes that don't exist in simulation.

### Phase B — Hybrid (months 6-12)

PoUW becomes authoritative for receipt-bearing blocks; the existing chain
becomes authoritative for transactions only. Both are produced in
parallel; periodic checkpoints anchor each into the other.

Goal: real economic value flowing through PoUW, but with a fallback
chain in case of unrecoverable consensus failure.

### Phase C — Cutover (month 12+)

The Narwhal/Bullshark chain stops producing blocks. PoUW is the sole
chain. The hybrid checkpoints become a one-way migration of historical
state from the legacy chain.

The migration is gated on PoUW chain stability metrics: 30 consecutive
days of fork-free operation under the same load profile that broke the
previous chain.

## Drawbacks

1. **Block time is workload-dependent.** If research progress slows (the
   network finds a hard period where no one is producing receipts above
   difficulty), block times grow. Difficulty adjustment compensates over
   epochs, but short-term variance is higher than in a hash-based PoW.
   *Mitigation:* longer epoch length for difficulty (~24 hours) plus a
   minimum block reward at very-low-progress periods to keep miners
   motivated through troughs.

2. **Concentration toward easy projects.** Miners may rationally
   concentrate on the easiest project (one with the lowest historical
   delta thresholds), starving harder projects. *Mitigation:*
   curriculum_factor in the reward function specifically rewards harder
   downstream projects more.

3. **Cost of zk verification at chain throughput.** Verifying every
   block's zk proof is the chain's bottleneck. At 60-second blocks
   and ~50ms verification, this is fine; at 6-second blocks, it's
   tight. The block-time target should be chosen with verification
   cost as the binding constraint.

4. **No fallback if zkML is broken.** If a vulnerability in the proof
   system (Groth16 trapdoor, SP1 soundness bug) is discovered, every
   chain block from that proof system is suspect. *Mitigation:*
   support multiple proof systems concurrently; chain difficulty can
   be adjusted to favor proof systems with stronger soundness
   guarantees if a weakness emerges.

## Alternatives considered

### A1. Keep Narwhal/Bullshark; just fix the bugs

Fixing the immediate bugs (#15, #18) is necessary regardless. But
keeping the chain decoupled from research preserves the structural
problem: economic incentives misaligned with the network's purpose.
Bug fixes are tactical; PoUW is structural.

### A2. Proof-of-Stake

PoS aligns incentives by stake, not by useful work. It requires an
on-chain token economy mature enough that staking is meaningful, which
the chain (Chain ID 808080, currently in active development) is not.
PoUW is also more fitting for the network's identity: research is the
purpose, so research should secure the chain.

### A3. Federated validation by foundation nodes

A small set of trusted validators could re-run experiments and sign
blocks. This trades the chain's stated peer-to-peer property for
stability. Contrary to the project's mission.

## Open questions

- **Inter-project difficulty equalization.** How exactly does
  `difficulty` compare across projects with different metrics
  (val_loss, Sharpe ratio, NDCG)? A common normalization function is
  needed. Current proposal: each project declares its own normalization
  (typically `delta / std_dev_of_recent_deltas`); chain consensus is
  on the *normalized* delta, not the raw value.

- **MEV on PoUW.** A miner could withhold a high-delta receipt and
  release it later when the difficulty has dropped. Mitigation:
  receipts must be timestamped and include a recent block hash as
  freshness proof, narrowing the withholding window.

- **Reward smoothing.** Should rewards be paid out as deltas land
  (high variance) or smoothed across an epoch (predictable)? Both
  designs work; epoch-smoothed is more friendly to small miners.
