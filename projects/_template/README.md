# Project Template

To propose a new research project:

1. Copy this directory to `projects/<your-project-name>/`
2. Edit `README.md` with your project description, dataset, and what to explore
3. Set baseline config in `baseline/config.yaml`
4. Run the baseline and record results in `baseline/results.json`
5. Create an empty `LEADERBOARD.md`
6. Open a PR to add the project to main

## Requirements

- Dataset must be downloadable or generatable by agents
- Baseline should be trainable in <5 minutes on a single GPU
- Config follows the standard TrainingScript YAML format (see other projects)
