# Changelog

All notable changes to the Hyperspace AGI repository (this archive of
research, agents, projects, and protocol RFCs) are recorded here.

This is **not** the changelog for the CLI binary or the chain binary —
those have their own release notes. This file tracks changes to **the
repository content**: documentation, research projects, schemas, scripts,
RFCs, and CI infrastructure.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions: date-based [CalVer](https://calver.org/) (`YYYY.MM.PATCH`).

---

## [Unreleased]

### Added
- `SECURITY.md` — threat model, vulnerability reporting policy, scope.
- `CHANGELOG.md` — this file.
- `.github/ISSUE_TEMPLATE/` — structured templates for bug reports and RFCs.
- `.github/PULL_REQUEST_TEMPLATE.md` — PR checklist.
- `.github/workflows/validate-projects.yml` — CI that verifies every project has the required structure (README, baseline/config.yaml, baseline/results.json, LEADERBOARD.md).
- `docs/runbooks/` — operator runbooks for the most common incidents:
  - `chain-fork-recovery.md`
  - `sidecar-crash-recovery.md`
  - `full-node-bootstrap.md`
- `projects/matrix/baseline/` — baseline config and results for the previously incomplete Matrix neural retrieval project.

---

## [2026.05.07] — open contribution batch

Same-day batch of four pull requests (#20, #21, #22, #23). The grouping
below reflects the PR each change came from; the order within the day
matches the order PRs are expected to merge.

### Added (PR #20)
- `CONTRIBUTING.md` — full contributor guide.
- `projects/architect/baseline/` — baseline for the architect project.

### Added (PR #21)
- `.github/workflows/network-snapshots.yml` — resumes hourly snapshots stalled since 2026-03-11 (closes #12).
- `docs/POSTMORTEM_2026-04-09_FOUR_WAY_CHAIN_FORK.md` — incident documentation for #15.

### Added (PR #22)
- `docs/VISION.md` — Compounding Intelligence Roadmap.
- `docs/rfcs/RFC-001-verifiable-research.md` — every experiment carries a signed receipt with graduated proof ladder.
- `docs/rfcs/RFC-002-curriculum-dag.md` — projects form a DAG of prerequisites; weights transfer along edges.
- `docs/rfcs/RFC-003-pouw-consensus.md` — Proof-of-Useful-Work consensus.
- `docs/rfcs/0000-template.md` — RFC template.
- `docs/rfcs/README.md` — RFC process documentation.
- `schemas/research-receipt-v1.schema.json` — JSON Schema for receipts.
- `scripts/sign-receipt.js` — Ed25519 signer.
- `scripts/validate-receipt.js` — reference validator.
- `scripts/validate-receipt.test.js` — 17 unit tests, all passing.

---

## [2026.03.13] — Pods documentation

### Added
- `docs/PODS.md` — full Pods command reference and Claude Code MCP integration guide.

### Changed
- Refocused Pods docs on distributed/sharded inference.

---

## [2026.03.08] — repository created

Initial structure: project README, project template, agents directory, blockchain README, model release for `qwen2.5-0.5b-hyperspace-v1`, and the seven seed research projects.

---

## How to update this changelog

When opening a PR with a meaningful repo change, add an entry to `[Unreleased]`. Categories:

- `Added` — new files, RFCs, projects, schemas
- `Changed` — modifications to existing content
- `Deprecated` — items to be removed in a future release
- `Removed` — items removed
- `Fixed` — bug fixes
- `Security` — security-relevant changes

When a release is cut, maintainers move `[Unreleased]` entries under a new dated heading.
