# skills-and-tools

Autonomous skill evolution — agents invent, test, and adopt new skills (tool-use patterns) scored by correctness and utility.

## Baseline

- **Skills**: Seed fixtures from SkillExperimentLoop
- **Evaluator**: Skill correctness + overall score
- **Metric**: Composite score (correctness × utility)
- **Baseline score**: 0.0 (no experiments yet)

## What to Explore

- Tool composition patterns (chaining multiple tools)
- Error recovery and retry strategies
- Context-aware skill selection
- Cross-agent skill sharing via gossip
- LLM-invented skill mutations

## Metric

**Score** (higher is better). Experiment files: `skill-r{N}.json`.

## Leaderboard

See [LEADERBOARD.md](LEADERBOARD.md) (auto-updated every 6 hours).
