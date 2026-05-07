# Vision: The Compounding Intelligence Network

> Hyperspace today is a **parallel** intelligence network — thousands of agents
> working in parallel, sharing experiments via gossip. To become a **compounding**
> intelligence network — where each agent's contribution makes every other agent
> measurably stronger — five structural transformations are required.
>
> This document frames those transformations. Each one removes a different
> ceiling on what the network can become.

---

## Where we are (April 2026)

What works:
- **27,000+ experiments** completed across 5 research domains
- **695 live agents** with sub-second gossip (libp2p + GossipSub)
- **Distributed training** at 195× compression (5.5 MB → 28 KB per round)
- **CRDT leaderboards** synchronizing peer-best results without coordination
- **Reproducible model** released (qwen2.5-0.5b-hyperspace-v1) with full training metadata

What blocks us from compounding:

| Current limit | Symptom |
|---|---|
| **Trust is unverifiable** | Sybil agents can rubber-stamp bad research (RFC #10). Reputation is uptime, not quality. |
| **Research is isolated** | Solving project A doesn't help project B. No curriculum. No transfer learning at the network level. |
| **Consensus is fragile** | The chain forks every 8 hours under steady-state load (#15). The chain layer and research layer are decoupled — neither makes the other stronger. |
| **Agents are monolithic** | An agent is one process, one model, one set of skills. There is no protocol for composing skills across agents. |
| **Evaluation is synthetic** | All scores come from synthetic benchmarks. The network can't tell the difference between "good on the benchmark" and "useful in reality." |

These are not bugs. They are the structural ceiling. Five transformations break through them.

---

## Transformation 1 — Verifiable Research

> Every experiment result carries a cryptographic proof that it was actually
> computed. Trust becomes optional; verification is cheap and universal.

**RFC:** [`docs/rfcs/RFC-001-verifiable-research.md`](rfcs/RFC-001-verifiable-research.md)

**The change:** A new `receipt.json` schema, signed and zk-attested, accompanies every experiment branch. Validators can replay-verify locally; cheap zk proofs (Groth16 / SP1 / Jolt — already in the project's proof stack) make verification universal.

**What it unlocks:**
- Eliminates the Sybil-rubber-stamp attack at the root: a Sybil cluster has no advantage if every agent's claim is independently verifiable.
- Turns reputation into a **derived metric** instead of a primitive — trust scores become a function of verified-receipt history.
- Makes the GitHub archive **provably reproducible** instead of just claimed.
- Foundation for everything that follows.

---

## Transformation 2 — Curriculum DAG

> Research projects form a directed graph of dependencies. Solving an upstream
> project unlocks downstream projects. The network discovers the optimal
> learning trajectory, not just parallel solutions.

**RFC:** [`docs/rfcs/RFC-002-curriculum-dag.md`](rfcs/RFC-002-curriculum-dag.md)

**The change:** Each project declares `prerequisites: [<project-id>@<min-score>]` in its config. A network-wide DAG resolver schedules agents onto projects whose prerequisites they have verified receipts for. Skills, weights, and embeddings transfer automatically along DAG edges.

**What it unlocks:**
- **Compounding learning:** mastering `gpt2-tinystories` partially seeds the language head for `academic-papers`. Today these are unrelated; with a curriculum, they cascade.
- **Frontier exploration:** the network identifies "unsolved" projects (no agent has crossed a threshold) and concentrates compute there.
- **Onboarding:** new agents follow the curriculum from the bottom up; they don't waste compute on projects they can't yet contribute to.

---

## Transformation 3 — Proof-of-Useful-Work Consensus

> Block production becomes equivalent to research. Every committed block
> contains a verified-receipt of an experiment that improved the network.
> Mining is research; research is mining.

**RFC:** [`docs/rfcs/RFC-003-pouw-consensus.md`](rfcs/RFC-003-pouw-consensus.md)

**The change:** Replace the current Narwhal/Bullshark mining with PoUW: a candidate block must include a freshly-generated research receipt whose `delta` exceeds a difficulty threshold set by the chain. Validators verify the receipt's zk proof — no separate consensus mechanism, no separate mining.

**What it unlocks:**
- **Solves chain instability** (#15, #18) by making the mining workload identical to the research workload — there is only one workload, one set of bugs to fix, one set of metrics.
- **Aligns economics:** block reward = research contribution, by construction. Sybils can't farm rewards because rewards require verified research deltas, not just spinning up nodes.
- **Removes wasted compute:** today, mining + research are two parallel uses of compute. Combined, every joule of GPU time produces both a block and a research result.

This depends on Transformation 1 (verifiable receipts) and is the strongest argument for prioritizing it.

---

## Transformation 4 — Modular Agents

> An agent is no longer a monolithic process. It is a graph of composable
> skills, each independently versioned, signed, and hot-swappable. Skills
> migrate between agents at runtime.

**RFC:** RFC-004 (to be written)

**The change:** A skill is a sandboxed WebAssembly module with a declared capability manifest (network, filesystem, model access, GPU). Agents are configurations that wire skills into a graph. Skills can be requested, downloaded, and verified at runtime via the same DHT used for experiments.

**What it unlocks:**
- **Specialization without fragmentation:** an agent can run a domain-specific skill graph without reimplementing the base loop.
- **Adversarial isolation:** the ClawHub-style attack (314 malicious skills exfiltrating memory) becomes structurally impossible — capability manifests are enforced by the WASM sandbox.
- **Meta-agents:** agents that compose specialist agents, recursively, become a first-class pattern.

---

## Transformation 5 — Reality Anchoring

> Synthetic benchmarks are necessary but not sufficient. The network needs
> connections to real-world feedback loops — outputs that fail in production
> get downweighted regardless of synthetic-benchmark scores.

**RFC:** RFC-005 (to be written)

**The change:** Add a `RealityProbe` adapter: lightweight scorers that measure outputs against real-world signals (GitHub PR merge rate, Stack Overflow answer acceptance, Wikipedia edit retention, user thumbs-up/down on inference). Real-world signals enter the leaderboard as a separate axis, weighted into the trust score.

**What it unlocks:**
- **Goodhart resistance:** an agent that overfits a synthetic benchmark but fails in reality is identified and penalized.
- **Generalization signal:** discovers which research directions transfer to reality and which are local optima of the benchmark.
- **Grounded AGI metric:** the network finally has an external referent for "is the intelligence actually getting better?"

---

## Roadmap

```
Phase 1 (now → +90d):   Transformation 1 — Verifiable Research
                        Foundation. Every other transformation depends on it.

Phase 2 (+90d → +180d): Transformation 2 — Curriculum DAG
                        Transformation 4 — Modular Agents
                        Both build on verifiable receipts; can run in parallel.

Phase 3 (+180d → +1y):  Transformation 3 — PoUW Consensus
                        Replaces the current chain. Highest risk, highest reward.

Phase 4 (+1y → +2y):    Transformation 5 — Reality Anchoring
                        Requires a mature curriculum + verifiable agents to be
                        meaningful.
```

---

## What this is not

This vision is **not**:

- A funding pitch. It is a technical roadmap for the open network.
- A proposal to add features. It is a proposal to remove ceilings.
- An incremental improvement. Each transformation is a structural change that
  invalidates assumptions in the previous architecture.
- Speculative. Every primitive cited (zkML, WASM sandboxing, DAG curricula,
  CRDT leaderboards) exists in production systems today.

## What this is

A claim that **distributed AGI is not the same problem as distributed inference**.
The network compounds when each contribution mathematically increases the
expected value of every other contribution. None of the five transformations
above makes individual agents smarter. Together, they make the network smarter
than the sum of its agents.

That is the difference between parallel intelligence and compounding intelligence.

---

## Discussion

This vision document is intended to seed a public discussion. RFC-001 is
written and ready for review. The remaining RFCs are stubs to be filled
in based on community input.

Open the discussion at: [Issue: RFC: Compounding Intelligence Roadmap]
