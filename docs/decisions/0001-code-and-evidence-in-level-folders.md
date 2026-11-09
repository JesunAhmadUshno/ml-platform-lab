# 0001. Keep code, specs and evidence in the level folders under standard v2

Date: 2026-11-08. Status: accepted.

## Context

Standard v2 suggests src/, experiments/ and results/. Here each level
folder holds its simulator and runner next to the results file the
runner wrote, and the Build and Deep folders hold the spec each level
was built from (BUILD-SPEC.md, and DEEP-SPEC.md with its hand-computed
oracle). The site, the tests, CI and the dated write-ups all read
these files by path.

## Decision

Keep level-1-learn/, level-2-build/ and level-3-deep/ as domain-named
folders, listed in the README layout table, instead of splitting them.
The level specs stay with their code; the top-level SPEC.md, NOVELTY.md
and DOSSIER.md move into PROPOSAL.md.

## Consequences

No path churn and no broken links in the tests or write-ups. The README
layout table and REPORT.md's results table map each number to its
evidence file.
