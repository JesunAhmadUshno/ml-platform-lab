# PUBLICITY: ml-platform-lab (P20)

Publicity log under the documentation and publishing standard,
Section 7. Every finished level produces its written fan-out set.
Drafts are prepared by the loop. Actual social posting follows
the standing platform rules and gates. The loop itself never posts
to social.

Project state: v1.0, Learn, Build, and Deep done 2026-11-05,
96 checks passing plus the scaffold smoke test. Every level is a simulation, labelled as
such: no real cluster was contacted at any level.

## Actions polish pack (2026-11-05)

Applied through a pull request on 2026-11-05, following the Actions
polish pack standard. The pack adds: CI on a Python 3.11 and 3.12
matrix with a ruff lint step (the pre-existing CI steps preserved:
scaffold smoke test; plus per-level test and runner steps for Learn,
Build, and Deep, following the proven pack pattern), CodeQL
scanning, Dependabot for pip and GitHub Actions, a release workflow
that attaches a source tarball named
ml-platform-lab-<tag>.tar.gz to v* tag releases, Labeler,
Greetings (snake_case inputs for actions/first-interaction@v3:
repo_token, issue_message, pr_message), Stale in comment-only mode
(days-before-close: -1, never closes), and a docs summary page at
docs/index.md for GitHub Pages. Ruff scope is recorded in
ruff.toml (E, F, I, line-length 120). Ruff fixes in this pull
request were style only: 5 initial errors, all I001 import order
or format, fixed by ruff fix output, with no change to behaviour,
to any imported name that is used, or to any string value. All
three results files stayed byte-identical across the runners;
this project carries no timing fields, so no timing-only diff
arose. requirements.txt records the
standard-library-only fact so Dependabot pip has a manifest
to watch.

| Channel | Outcome on 2026-11-05 |
| --- | --- |
| GitHub Pages | Docs page added at docs/index.md in this pull request. Pages enablement and live build status are verified after merge and recorded in the batch ledger; no live claim is made in this file before that check. |
| PyPI publishing | Held: needs a PyPI token, a new credential. Jesun's tap only. Not set up. |
| Social channels (LinkedIn, X, Facebook, Instagram, Threads) | Held: no posts made. The loop never posts to social; Threads waits for Jesun's tap per post under the standing gates. |

## v1.0 fan-out set (2026-11-05)

Written fan-out set prepared in this cycle, in fanout/. Every
piece states plainly that this is a simulated platform:
simulated jobs, simulated GPU scheduling, simulated quotas, a
KServe-style endpoint that is a model of KServe, and a simulated
operator, with no real cluster contacted at any level, and that
the Deep cost page is modelled from invented unit prices. Every
number is sourced from the repo files
(README.md, DOSSIER.md, the three level READMEs, and the three
results files). Tutorial commands were verified by running
them; the full suite (96 checks plus the scaffold smoke test)
passes and all three results files stayed
byte-identical across the runners; this project carries no
timing fields, so no timing-only diff arose.

Jev claim_check on the blog main results claim (extracted byte
exact from fanout/blog-post.md by script): model jev-1.13.0,
717 input tokens, question id supported, noul 0.80, route
REVIEW (claim_check bands: clear at 0.85 or above, block at
0.10 or below, review between). Spec and results are in the
goal hidden_files (jev-p20-fanout-claim-spec-2026-11-05.json
and jev-p20-fanout-claim-results-2026-11-05.json).

| Channel | Piece | Outcome on 2026-11-05 |
| --- | --- | --- |
| GitHub release v0.1 | Learn release | Live: https://github.com/JesunAhmadUshno/ml-platform-lab/releases/tag/v0.1 |
| GitHub release v0.5 | Build release | Live: https://github.com/JesunAhmadUshno/ml-platform-lab/releases/tag/v0.5 |
| GitHub release v1.0 | Learn, Build, Deep release | Live: https://github.com/JesunAhmadUshno/ml-platform-lab/releases/tag/v1.0 |
| GitHub Pages | Docs summary page | Live, built: https://jesunahmadushno.github.io/ml-platform-lab/ (legacy, main, /docs, verified HTTP 200 after the polish pack merge) |
| Repo (blog) | Blog post draft | fanout/blog-post.md, repo draft. Not posted to any blog platform. |
| Repo (tutorial) | Tutorial draft | fanout/tutorial.md, repo draft. Every command verified by running it in this cycle. |
| Repo (website) | Website page copy draft | fanout/website-page.md, copy only. No website was changed by this file. |
| LinkedIn | Post draft | fanout/linkedin-post.md, DRAFT NOT POSTED. Held: posting follows the standing platform rules; the link is carried as the first-comment line in the draft, per the LinkedIn rule. |
| Paper | Candidate brief | fanout/paper-candidate.md. Submission is Jesun's tap; nothing submitted, no venue contacted. |
| Repo (release notes) | Release notes | fanout/release-notes.md, covering v0.1, v0.5, and v1.0 with simulated results and release links verified with gh release list. |
| X | Social post | Held: no post made. The loop never posts to social; drafts only under the standing platform rules. |
| Facebook | Social post | Held: no post made. Standing Facebook rule applies (no link in body or comments, keyword call to action by DM) and the loop never posts to social. |
| Instagram | Social post | Held: no post made. Standing Instagram rule applies (link in bio) and the loop never posts to social. |
| Threads | Social post | Held: awaiting Jesun's tap. Every Threads post needs his one-tap pre-approval, hash-locked on exact text and media. |
| Video | 3D playbook video | Held: flagship video production runs through the January engine queue. No video produced in this cycle. |
| Book | Book chapter | Held: chapter drafted from finished projects under the journey publishing plan; no chapter file is claimed in this cycle. |
