# DAG-1 — Task Decomposition for the Gossip Network

**Describe a complex task. DAG-1 decomposes it into a parallelizable subtask graph, caches the plan, and shares it across the P2P network.**

The network remembers how to solve problems.

## Try It

**Web:** [dag.hyper.space](https://dag.hyper.space)

**CLI:**
```bash
hyperspace dag "deploy my app to kubernetes with monitoring"
```

**SDK:**
```javascript
const dag = await hyperspace.dag.decompose(
  'Build a React landing page with auth and monitoring'
)
// → { subtasks: 6, criticalPath: 3, maxParallelism: 3, confidence: 0.87 }
```

## What It Does

DAG-1 takes a complex task and produces a `TaskDag` — a directed acyclic graph of typed subtasks with dependency edges, critical path analysis, and parallelism detection.

```
Task: "Build a React landing page with auth"

                ┌──────────────────────┐
                │  DAG-1 decompose     │
                └────┬──────┬──────┬───┘
                     ▼      ▼      ▼
              ┌──────┐┌──────┐┌──────┐     ← depth 1 (parallel)
              │ S1   ││ S2   ││ S3   │
              │scaf- ││design││config│
              │fold  ││system││ auth │
              └──┬───┘└──┬───┘└──┬───┘
                 ▼       ▼       ▼
              ┌──────┐ ┌──────┐         ← depth 2 (parallel)
              │ S4   │ │ S5   │
              │pages │ │wire  │
              │      │ │auth  │
              └──┬───┘ └──┬───┘
                 ▼        ▼
              ┌────────────┐             ← depth 3 (sync)
              │    S6      │
              │test+deploy │
              └────────────┘

Critical path: S2 → S4 → S6 (longest chain)
Max parallelism: 3 (S1 + S2 + S3 run together)
Wall-clock: ~2 min 25s (vs ~4 min sequential)
```

## Architecture

Four layers, one cache:

```
┌─────────────────────────────────────────────────┐
│  LAYER 4: SIMILARITY INDEX                      │
│  MinHash (128 functions) + cosine verification  │
│  Threshold: 0.70 — fuzzy matching               │
├─────────────────────────────────────────────────┤
│  LAYER 3: DHT RESOLVER                          │
│  Provider records at /dag-plans/<hash>           │
│  GossipSub: hyperspace/dag-cache/announcements   │
│  Protocol: /hyperspace/dag-cache/1.0.0           │
├─────────────────────────────────────────────────┤
│  LAYER 2: CONTENT STORE                          │
│  SHA-256 content addressing, LRU (10K, 7d TTL)  │
│  Quality gating: <60% success → auto-evict       │
├─────────────────────────────────────────────────┤
│  LAYER 1: NORMALIZATION                          │
│  lowercase, strip stop words, sort keywords      │
│  "Build a React page" = "build page react"       │
├─────────────────────────────────────────────────┤
│  TRANSPORT: GossipSub + DHT over libp2p          │
└─────────────────────────────────────────────────┘
```

## Cache Resolution

When a task arrives, DAG-1 tries to skip inference entirely:

| Step | Method | Latency | Tokens |
|------|--------|---------|--------|
| 1 | Local cache (SHA-256 exact match) | ~2ms | 0 |
| 2 | Similarity index (MinHash + cosine) | ~15ms | 0 |
| 3 | DHT provider query (fetch from peers) | ~200ms | 0 |
| 4 | DAG-1 LLM inference (fallback) | ~3-8s | 500-2,000 |

Each resolution caches the result. Future lookups are faster for everyone.

## P2P Gossip — Why It Matters

On a centralized platform, cached plans live on one server. On Hyperspace, **every node contributes to and benefits from a shared plan cache**.

```
Node A: 47 k8s deployment plans
Node B: 23 React build plans
Node C: 31 API endpoint plans
    ↓
    GossipSub announcements
    ↓
New node joins → DHT query → finds plans instantly
→ Zero inference. Zero tokens. Just cache hits.
```

Three gossip channels:

```
/hyperspace/dag-cache/1.0.0

Gossip topics:
  hyperspace/dag-cache/announcements  — new DAG plans available
  /dag-plans/<hash>                   — DHT provider records
  hyperspace/dag-cache/outcomes       — execution results (self-curating)
```

**Self-curating cache:** Every execution records success/failure. Plans with <60% success rate after 5 samples are auto-evicted. Good plans survive. Bad plans die.

**Similarity clustering:** "Deploy React app" and "deploy Vue app" share 80% structure. MinHash finds these connections. One plan seeds a family.

## Data Model

```typescript
interface TaskDag {
  subtasks: DagSubtask[]       // Typed subtasks with agent assignments
  edges: DagEdge[]             // depends_on | feeds_into | blocks
  criticalPath: string[]       // Longest dependency chain
  maxParallelism: number       // Width of widest parallel level
  totalSubtasks: number
  confidence: number           // DAG-1's confidence (0-1)
  reasoning: string            // Why this decomposition
}

interface DagSubtask {
  id: string
  description: string
  agentType: string            // coding | design | infra | testing
  estimatedDurationMs: number
  dependencies: string[]
  parallelizable: boolean
  priority: number             // 1-10
}
```

## Research DAG

DAG-1 also powers the `ResearchDAG` — a flywheel-style graph for autonomous research:

- **Observations** — papers, articles, datasets discovered by agents
- **Experiments** — hypotheses tested with code artifacts
- **Syntheses** — LLM-generated insights combining multiple parents
- **Edge types** — inspired_by, tests, refutes, extends, synthesizes, mutated_from, cross_domain_transfer
- **7 domains** — ml-training, search-ranking, finance, skills, knowledge, infrastructure, physics

Content-addressed, append-only, P2P-shareable. The research history of the network as a DAG.

## Implementation

| Package | File | What |
|---------|------|------|
| `@hyperspace/network` | `dag-cache/dag-content-store.ts` | Content-addressed LRU store |
| `@hyperspace/network` | `dag-cache/dag-dht-resolver.ts` | DHT + GossipSub sharing |
| `@hyperspace/network` | `dag-cache/dag-similarity-index.ts` | MinHash + cosine matching |
| `@hyperspace/network` | `dag-cache/dag-cache-stats.ts` | Analytics + latency tracking |
| `@hyperspace/agent` | `research-dag.ts` | Flywheel research DAG |

## License

Part of the [Hyperspace](https://hyper.space) open network.
