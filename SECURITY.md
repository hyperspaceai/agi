# Security Policy

Hyperspace AGI is an open distributed network. The attack surface is wide
(P2P protocols, custom blockchain, distributed training, agent-executable
skills) and the consequences of a compromise can affect every node on the
network. This document defines the threat model, what is in and out of
scope for the security policy, and how to report a vulnerability.

---

## Reporting a vulnerability

**Do not file public issues for security vulnerabilities.** A public issue
exposes the bug to attackers before it can be patched.

Instead:

1. Use GitHub's **private security advisory** mechanism:
   <https://github.com/hyperspaceai/agi/security/advisories/new>
2. Or, if that is unavailable, email **security@hyper.space** with:
   - A clear description of the vulnerability
   - Reproduction steps (or proof-of-concept code)
   - Affected versions
   - Your assessment of severity (CVSS if you can)
   - Whether you've disclosed to anyone else

You should expect:

- An acknowledgement within **48 hours**.
- A first-pass triage (severity, scope, owner) within **7 days**.
- A fix or mitigation plan within **30 days** for high-severity issues.
- Credit in the resulting advisory, unless you ask to remain anonymous.

Coordinated disclosure: we'll work with you on a timeline. Default is
**90 days** from triage to public disclosure, with extensions if the fix
requires coordinated rollout across the network.

---

## Threat model

### Adversaries

| Adversary | Capabilities | What they want |
|-----------|--------------|----------------|
| **External attacker** | Network reachability, can run nodes, can submit PRs | Steal funds, disrupt consensus, exfiltrate data, build sybils |
| **Malicious miner** | Already a network participant, has a peer ID | Maximize rewards (sybil-stuffing receipts), withhold blocks |
| **Compromised package** | Can publish to npm/pypi/Docker Hub | Inject malicious code into the install path |
| **Malicious skill author** | Can publish skills the network executes | Exfiltrate agent memory, attack other agents (cf. ClawHub incident) |
| **Adversarial researcher** | Submits crafted experiments | Game the leaderboard, poison the receipt graph |

### Trust assumptions

- **The cryptographic primitives are sound** — Ed25519, SHA-256, TLS.
- **The libp2p stack is trusted.** Vulnerabilities in libp2p are upstream issues.
- **The Node.js runtime is trusted.** RCE in Node.js means full compromise by definition.
- **Local filesystem is trusted.** We do not defend against an attacker with write access to `~/.hyperspace/`.

### What we do defend against

- **Sybil attacks** on the receipt-attestation layer (RFC-001).
- **Replay attacks** on receipts: timestamp + freshness anchor.
- **Eclipse attacks** on individual nodes: bootstrap diversity.
- **Memory exfiltration via skills** (future RFC-004 sandboxing).
- **Supply-chain attacks** on dependencies: lockfile pinning + reproducible builds.
- **Result fabrication**: cryptographic receipts (RFC-001).

### Out of scope

- DoS of individual nodes by resource exhaustion (network tolerates node loss).
- Side-channel attacks on TEE attestation (upstream vendor responsibility).
- Physical attacks on hardware.
- Social engineering of operators.
- Bugs that crash an agent without affecting other agents or network safety properties — these go through normal issue triage.

---

## In-scope components

| Component | Scope | Notes |
|-----------|-------|-------|
| Hyperspace CLI | ✅ Full | Including SEA binary builds |
| Chain binary | ✅ Full | Consensus, mempool, RPC |
| Sidecar | ✅ Full | libp2p host process |
| Released models in `models/` | ✅ Limited | Reports of *poisoned* models, not "biased" |
| Project configs | ✅ Limited | Reports that a config exposes a vulnerability |
| Receipt schema/validator (RFC-001) | ✅ Full | |
| GitHub Actions workflows | ✅ Full | |
| Documentation | ❌ Out | Doc bugs go through normal triage |
| Forks and downstream packagings | ❌ Out | Report to those projects |

---

## Vulnerability severity

| Severity | Examples | Disclosure target |
|----------|----------|---|
| **Critical** | RCE on any node from network input. Forging valid receipts. Stealing wallet keys via network. Consensus rewriting. | Hotfix within 7 days |
| **High** | Sybil rubber-stamping at proof level `signed`. Memory exfiltration via skill. DOS affecting all bootnodes. | Fix in next release, ≤ 30 days |
| **Medium** | Information disclosure beyond documented public surface. Reliable specific-condition crashes. | Next major/minor, 60-90 days |
| **Low** | Minor information leaks. Hard-to-exploit bugs requiring unrealistic preconditions. | Batched with hardening |

---

## What contributors can do

- **Security review of PRs** touching chain, sidecar, or wallet code.
- **Reproducible builds.** Help us reach bit-for-bit reproducibility — the strongest defense against supply-chain attacks.
- **Threat-model updates.** PRs to this document are welcome.
- **RFC review.** Security-relevant RFCs (RFC-001, RFC-003, RFC-004) benefit from people who think adversarially.

---

## Cryptographic transparency

All releases must be:

- Signed with a known release key (PGP / Sigstore).
- Reproducible from a tagged commit.
- Have their hashes published in the release notes and on the network-snapshots branch.

If you receive a binary whose hash does not match the published value, **do not run it** and report the discrepancy via the channels above.
