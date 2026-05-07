# Operator Runbooks

When something goes wrong on the network, the runbook here is the fastest
path back to a healthy state. These are not theoretical guides — each one
is written for the specific incident class it addresses, with concrete
commands and expected output.

## Index

| Runbook | When to use |
|---------|-------------|
| [chain-fork-recovery.md](chain-fork-recovery.md) | Validators on different forks; `eth_blockNumber` returns different hashes across nodes |
| [sidecar-crash-recovery.md](sidecar-crash-recovery.md) | `Error: SidecarConfig required for NetworkNodeAdapter.start()` after a network blip (#17) |
| [full-node-bootstrap.md](full-node-bootstrap.md) | First-time setup of a full node, or recovering from total state loss |

## Conventions

Every runbook follows the same structure:

1. **Symptoms** — exact log lines, error messages, or metrics that confirm you have this incident.
2. **Diagnosis** — quick checks to confirm the root cause vs. a similar-looking issue.
3. **Recovery** — numbered, copy-pasteable commands. If a step is destructive (loses data) it is clearly marked.
4. **Verification** — how to confirm recovery actually succeeded.
5. **Prevention** — what to do so this doesn't recur.

## Adding a runbook

When you encounter an incident that took >30 minutes to diagnose, write a
runbook even if there isn't one yet. Future-you (and the rest of the
network) will thank present-you.

Open a PR adding `docs/runbooks/<incident-class>.md` following the
structure above. Link it from this index.
