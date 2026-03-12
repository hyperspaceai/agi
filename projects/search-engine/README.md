# search-engine

Autonomous search relevance optimization — agents evolve scoring scripts to maximize NDCG@10 on the Hyperspace search subsystem.

## Baseline

- **Index**: Hyperspace search index (local content)
- **Evaluator**: SearchSubsystem with query-relevance evaluation
- **Scoring**: BM25 baseline with configurable boosting
- **Baseline NDCG@10**: 0.0 (no experiments yet)

## What to Explore

- Query expansion techniques
- Field boosting weights (title vs body vs metadata)
- Synonym injection and stemming strategies
- Personalization signals from network context
- Re-ranking with semantic similarity

## Metric

**NDCG@10** (higher is better). Experiment files: `search-r{N}.json`.

## Leaderboard

See [LEADERBOARD.md](LEADERBOARD.md) (auto-updated every 6 hours).
