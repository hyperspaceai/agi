# academic-papers

Autonomous literature analysis — agents evolve extraction pipelines to maximize entity/relationship/claim extraction quality from scientific papers.

## Baseline

- **Evaluator**: Literature-analysis evaluator (entity/relationship/claim coverage)
- **Metric**: Extraction F1 (composite of entity, relationship, and claim extraction quality)
- **Baseline F1**: ~0.3

## What to Explore

- Entity type expansion (genes, proteins, drugs, diseases, pathways)
- Relationship extraction patterns
- Claim classification (hypothesis, result, method, limitation)
- Citation graph analysis
- Metadata extraction and normalization

## Metric

**Extraction F1** (higher is better). Experiment files: `run-{N}.json`.

## Leaderboard

See [LEADERBOARD.md](LEADERBOARD.md) (auto-updated every 6 hours).
