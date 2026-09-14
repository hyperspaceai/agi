# RFC-002: Curriculum DAG — Compounding Learning Across Projects

| Field | Value |
|-------|-------|
| **Status** | Draft |
| **Created** | 2026-05-07 |
| **Depends on** | RFC-001 (Verifiable Research) |
| **Blocks** | — |

---

## Summary

Promote the network's research projects from a flat set of independent
benchmarks to a **curriculum DAG**: a directed acyclic graph in which
upstream projects are prerequisites for downstream projects, weights
and embeddings transfer along edges, and agents are scheduled onto projects
they have demonstrably mastered upstream.

The result is a network that compounds learning instead of parallelizing it.

## Motivation

### The flat-projects ceiling

Today, every project under `projects/` is independent:

```
projects/
├── academic-papers/
├── astrophysics/
├── financial-analysis/
├── gpt2-tinystories/
├── matrix/
├── p2p-network/
├── search-engine/
└── skills-and-tools/
```

A breakthrough on `gpt2-tinystories` does not — by any current mechanism —
make `academic-papers` easier. Each project has its own dataset, its own
metric, its own baseline. An agent that becomes excellent at one transfers
**zero verified knowledge** to the others.

This is parallel intelligence. It scales linearly: 2× compute → 2× experiments,
not 2× learning per experiment.

### What compounding looks like

A curriculum DAG embeds the natural dependency structure of the research:

```
                    gpt2-tinystories  ◄── language modeling foundation
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
       academic-papers  search-     skills-and-
              │         engine       tools
              │           │            │
              └─────┬─────┴────────────┘
                    ▼
             autonomous-research  ◄── synthesis project
                    │
                    ▼
              architect (DAG planning)
```

When an agent's verified-receipt for `gpt2-tinystories` shows mastery (val_loss
below threshold), it is eligible to work on `academic-papers`. Its trained
weights from `gpt2-tinystories` are the **initialization** for `academic-papers`,
not a fresh random init. A baseline run on `academic-papers` already starts
ahead of the previous baseline because it inherits a foundation.

This is compounding intelligence. It scales super-linearly: 2× compute,
applied along the DAG, produces more than 2× progress because progress on
upstream nodes accelerates downstream work.

## Design

### DAG declaration

Each project's `baseline/config.yaml` gains a `curriculum` block:

```yaml
# projects/academic-papers/baseline/config.yaml
curriculum:
  prerequisites:
    - project: gpt2-tinystories
      minMetric: val_loss
      maxValue: 1.5            # must be ≤ 1.5 to qualify
      proofLevel: zk-groth16   # required level (depends on RFC-001)
    - project: search-engine
      minMetric: ndcg
      minValue: 0.4
      optional: true           # not required, but unlocks bonuses

  transfers:
    - from: gpt2-tinystories
      type: weights            # weights | embeddings | tokenizer | adapter
      mapping: language-head   # which sub-graph to copy
    - from: search-engine
      type: embeddings
      mapping: query-encoder
```

### DAG validity rules

1. **Acyclic.** A CI workflow rejects any PR that introduces a cycle.
2. **Bootstrapped.** Every project's prerequisite chain terminates at the
   universal root: `projects/_root` (a synthetic project whose only
   "prerequisite" is the agent existing). This guarantees the graph is
   actually a DAG, not a forest of disconnected requirement chains.
3. **Cross-domain transfers must be declared.** An agent cannot silently
   re-use weights — the `transfers` field is the only authorized channel,
   and each transfer is recorded in the produced receipt's `parentReceipts`.

### The eligibility check

An agent is eligible to work on project `P` if and only if, for every
non-optional prerequisite `Q` of `P`:

```
∃ verified_receipt R such that:
  R.project == Q
  R.proof.level >= P.curriculum.prerequisites[Q].proofLevel
  R.peerId == agent.peerId   OR   R is in agent's trusted lineage
  R.result.value satisfies P.curriculum.prerequisites[Q].{min,max}Value
```

The "trusted lineage" clause allows an agent to satisfy prerequisites via
**inherited progress** — if peer A's receipt is a parent of peer B's
weights, B can use A's mastery of an upstream project. This is the
mechanism that makes the network compound: progress travels along the
receipt graph.

### Scheduling

The CLI's research loop is updated:

```
1. Pull latest curriculum DAG (cached, refreshed every snapshot interval).
2. Compute set of projects this agent is eligible to work on.
3. Of eligible projects, weight by:
     a. Frontier-ness: 1 / network_progress_in_last_24h(project)
     b. Local advantage: how much of the project's prerequisites this
        agent has uniquely strong receipts for.
     c. Personal preference: agent operator's `--prefer` config.
4. Sample a project from the weighted distribution.
5. Run experiment; produce verified receipt; gossip.
```

Frontier-weighting is the key term: it pushes the network to concentrate on
projects where progress has stalled, producing rapid front advance instead
of small parallel gains everywhere.

### Transfer mechanism

When project `P` declares `transfers[i] = { from: Q, type: weights, mapping: M }`:

- The CLI loads weights from the agent's most recent verified receipt on
  project `Q`.
- The mapping `M` (a named subset of the architecture, e.g.
  `language-head`, `embedding-table`) determines which tensors are copied.
- The new receipt for `P` includes `inputs.parentReceipts` that point to
  the source receipt on `Q`, making the lineage cryptographically traceable.

### Bootstrap: the seed curriculum

The project ships with a hand-crafted seed curriculum based on existing projects:

```
gpt2-tinystories ──→ academic-papers
                ╲
                 ╲──→ skills-and-tools
                  ╲
                   ╲──→ search-engine ──→ architect
                                       ╲
                                        ╲──→ autonomous-research

financial-analysis (independent — no upstream)
astrophysics (independent — no upstream)
matrix (independent — no upstream)
p2p-network (independent — no upstream)
```

The independents remain leaves in the DAG, available to all agents. As the
curriculum matures, contributors propose new edges via PR, with empirical
justification (transfer experiments showing the upstream actually helps).

### Visibility

The leaderboard generator extends to produce:

- `CURRICULUM.md` at the repo root: the full DAG rendered as a graph.
- Per-project sections showing which agents are working on each project,
  weighted by their position on the curriculum.
- A "frontier" page: projects where progress has been slowest in the last
  N days, suggesting where the network should concentrate.

## Interaction with other RFCs

- **Depends on RFC-001 (Verifiable Research):** prerequisites only mean
  something if the satisfying receipts are themselves verifiable.
  Without RFC-001, an agent could fabricate a `gpt2-tinystories` receipt
  to unlock downstream projects.

- **Composes with RFC-003 (PoUW Consensus):** if mining = research, then
  block reward should be proportional to the curriculum depth at which
  the work occurred. Receipts at deeper curriculum levels are harder to
  produce (more prerequisites) and should mint more value.

- **Enables RFC-005 (Reality Anchoring):** a curriculum lets the network
  identify which research paths transfer to reality. Real-world signals
  on a downstream project propagate upstream as edge-quality evidence —
  if mastering `gpt2-tinystories` correlates with real-world wins on
  `academic-papers`, the prerequisite edge is validated.

## Migration

The curriculum DAG is **purely additive** initially:

- Projects with no `curriculum` block behave exactly as today (eligible
  for all agents, no transfer).
- Projects that opt in get prerequisite gating and transfer support.
- Agents on older CLI versions ignore the curriculum block; they can still
  contribute but won't benefit from transfers.

Network-wide adoption is measured via the snapshot workflow: percentage of
new receipts that include `parentReceipts` from across-project transfers.

## Drawbacks

1. **Risk of premature DAG ossification.** If the seed curriculum is
   wrong (e.g., declaring an edge that doesn't actually transfer), agents
   waste time on bad prerequisite paths. Mitigation: edges are revisable
   via PR; a `curriculum-validator` workflow runs A/B comparisons of
   prerequisite-respecting vs. unrestricted experiments and flags edges
   whose transfer effect is statistically insignificant.

2. **Eligibility friction for new agents.** New agents have no receipts;
   how do they start? The bootstrap mechanism: every agent is implicitly
   eligible for projects whose prerequisites are all satisfied by the
   universal root. The DAG is designed so that at least one project per
   domain is reachable from the root with no upstream requirements.

3. **Computational cost of eligibility checking.** Validating prerequisites
   on every experiment requires receipt store lookups. Cost is bounded
   by the depth of the DAG (currently ≤4 for the seed curriculum) and is
   cached at the agent.

## Reference implementation (future work)

- `scripts/validate-curriculum.js`: CI workflow check that the DAG is
  acyclic and all `prerequisites.project` references resolve.
- `scripts/render-curriculum-dag.js`: generates `CURRICULUM.md` from project
  configs, runs in the leaderboard workflow.
- CLI updates (out of scope for this RFC) implement the eligibility check
  and the scheduling loop.

## Unresolved questions

- **Granularity of prerequisites.** Is a single `valLoss < 1.5` threshold
  enough, or do we need richer predicates (e.g., "in the top 10% of
  network results in the last 7 days")? Suggestion: start simple, add
  richness as needed.

- **Transfer specification.** The `mapping` field is currently a free-form
  string. A schema for named mappings per project should be defined so
  that transfers are unambiguous.

- **Negative-transfer detection.** Some pairs of projects might
  *negatively* transfer (training on A makes B harder). The curriculum
  should be able to express "incompatible" relationships, not just
  prerequisite relationships.
