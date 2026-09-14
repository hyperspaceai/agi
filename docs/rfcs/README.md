# Hyperspace RFCs

Substantial changes to the network — protocol, schema, consensus, economics —
go through an RFC (Request for Comments) before implementation. This directory
is the canonical home of those RFCs.

The RFC process exists so that **structural changes are debated in writing
before being built**, with a record of the alternatives considered and the
trade-offs accepted. It is not for trivial changes (typos, small features,
local refactors) — those go through a normal PR.

## Index

| # | Title | Status |
|---|-------|--------|
| [001](RFC-001-verifiable-research.md) | Verifiable Research Receipts | Draft |
| [002](RFC-002-curriculum-dag.md) | Curriculum DAG | Draft |
| [003](RFC-003-pouw-consensus.md) | Proof-of-Useful-Work Consensus | Draft |

See also: the [overall vision document](../VISION.md) for how these
RFCs compose into a coherent transformation roadmap.

## How to propose an RFC

1. **Discuss first.** Open an issue with the prefix `RFC:` and describe the
   problem at a high level. Get rough feedback before investing in a full
   RFC document. Many proposals are rejected at this stage cheaply, and
   those that survive arrive at the RFC stage already shaped by community
   input.

2. **Copy the template.** `cp docs/rfcs/0000-template.md docs/rfcs/RFC-NNNN-<slug>.md`
   where `NNNN` is the next available number.

3. **Fill in every section.** The template's sections are mandatory:
   Summary, Motivation, Design, Migration, Drawbacks, Alternatives
   considered, Open questions, Reference implementation. An RFC missing
   sections is a draft, not an RFC.

4. **Open a PR.** Title format: `rfc: RFC-NNNN: <title>`. The PR description
   should link to the discussion issue from step 1.

5. **Iterate based on review.** Substantive RFCs may take weeks of
   discussion. Update the document inline; the PR diff is the
   conversation.

6. **Status changes.**
   - `Draft` — being written or under initial discussion.
   - `Discussion` — under active community review.
   - `Accepted` — merged. Implementation can begin.
   - `Rejected` — closed without merge. Add a `## Why this was rejected`
     section before closing so future readers benefit.
   - `Superseded by RFC-NNNN` — replaced by a later RFC.

## What makes a good RFC

- **Specific.** Code, schemas, pseudo-code — not just intentions.
- **Honest.** Drawbacks acknowledged in writing strengthen the proposal.
  Drawbacks discovered after merge weaken everything.
- **Migrational.** How does the network get from today's state to the
  proposed state without breaking? An RFC without a migration plan is
  incomplete.
- **Bounded.** One RFC, one structural change. Bundled RFCs are harder
  to discuss, harder to accept piecewise, and harder to revert.
- **Self-contained.** A reader who has never seen the codebase should be
  able to understand the proposal. Link to context; don't assume it.
