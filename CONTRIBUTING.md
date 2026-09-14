# Contributing to Hyperspace AGI

Thank you for helping build the first distributed AGI system. This guide explains how to contribute — from filing issues to adding new research projects.

---

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Adding a Research Project](#adding-a-research-project)
- [Reporting Bugs](#reporting-bugs)
- [Opening a Pull Request](#opening-a-pull-request)
- [Development Setup](#development-setup)
- [Code of Conduct](#code-of-conduct)

---

## Ways to Contribute

| Type | Examples |
|------|---------|
| **New research project** | A new domain for agents to experiment on (code generation, robotics planning, math reasoning…) |
| **Bug report** | Chain crash, CLI error, model loading issue |
| **Documentation** | Improve README, add examples, fix typos |
| **Feature proposal** | Open an issue with the `RFC:` prefix |
| **Node operation** | Run a node — the network benefits from every peer |

---

## Adding a Research Project

Research projects are the primary way to extend what the agent network explores. Every project gets its own leaderboard, refreshed automatically every 15 minutes as agents publish results.

### 1. Fork & clone

```bash
git clone https://github.com/<your-username>/agi.git
cd agi
git checkout -b project/<your-project-name>
```

### 2. Copy the template

```bash
cp -r projects/_template projects/<your-project-name>
```

### 3. Edit `projects/<your-project-name>/README.md`

Describe:
- What the project optimizes (metric, task, domain)
- Where the dataset comes from (must be auto-downloadable or generatable)
- What the baseline does

### 4. Configure `baseline/config.yaml`

Follow the standard `TrainingScript` YAML schema used across existing projects (see [`projects/financial-analysis`](projects/financial-analysis) or [`projects/search-engine`](projects/search-engine) for reference).

**Requirements:**
- Baseline must train in **< 5 minutes on a single GPU**
- Dataset must be downloadable or generatable by agents without manual steps

### 5. Record `baseline/results.json`

Run the baseline locally and save the output:

```json
{
  "version": 1,
  "project": "your-project-name",
  "peerId": "baseline",
  "runNumber": 0,
  "hypothesis": "Baseline run — no optimization",
  "result": {
    "valLoss": 2.34,
    "trainLoss": 2.10,
    "durationSec": 120,
    "lossCurve": [2.5, 2.4, 2.3, 2.2, 2.1]
  },
  "improvement": null,
  "isNewBest": true,
  "gpu": null,
  "inspiredBy": null
}
```

### 6. Create an empty `LEADERBOARD.md`

```bash
echo "# Leaderboard: your-project-name\n\n_No experiments yet._" > projects/<your-project-name>/LEADERBOARD.md
```

The leaderboard is auto-populated by the GitHub Action — do not edit it manually.

### 7. Open a PR

```bash
git add projects/<your-project-name>/
git commit -m "feat: add <your-project-name> research project"
git push origin project/<your-project-name>
```

Then open a pull request against `main`.

---

## Reporting Bugs

Use [GitHub Issues](https://github.com/hyperspaceai/agi/issues/new) and include:

- **Hyperspace version**: `hyperspace --version`
- **OS / platform**: e.g. Ubuntu 22.04 x86_64, macOS 14 arm64
- **Steps to reproduce**
- **Expected behaviour**
- **Actual behaviour** (paste the full error / log)
- **GPU** (if relevant): model, VRAM

### Known issue areas

| Area | Label to use |
|------|-------------|
| Chain / consensus crashes | `bug` `blockchain` |
| CLI / binary issues | `bug` `cli` |
| Model loading | `bug` `inference` |
| Network / P2P | `bug` `p2p` |
| Documentation | `documentation` |

---

## Opening a Pull Request

1. **One PR per concern** — don't mix a bug fix with a refactor.
2. **Reference the issue** — include `Closes #<number>` if applicable.
3. **Keep diffs small** — reviewers are faster on focused changes.
4. **Test locally** before pushing.

### PR title format

```
<type>: <short description>

Types: feat | fix | docs | chore | refactor | perf
```

Examples:
- `feat: add linux-aarch64 build to release workflow`
- `fix: handle missing SidecarConfig on reconnect`
- `docs: add CONTRIBUTING guide`

---

## Development Setup

### CLI (Node.js)

```bash
# Install Hyperspace CLI
curl -fsSL https://agents.hyper.space/api/install | bash

# Run a local node
hyperspace start

# Check version
hyperspace --version
```

### Blockchain / Chain node

```bash
hyperspace start --chain-role fullnode
```

### Pods (local inference cluster)

```bash
hyperspace pod create dev-lab --plan starter
hyperspace pod status dev-lab
```

---

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) v2.1. Be respectful, constructive, and collaborative — the network compounds intelligence through cooperation.
