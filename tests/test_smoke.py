"""Portfolio standard checks: the required files exist and no public file carries a grade.

No lock-hash test: this repo is not pre-registered (PROPOSAL.md is not locked).
Add a SHA-256 pin here when the confirmatory proposal is tagged.
"""
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEED = ["README.md", "PROPOSAL.md", "REPORT.md", "CHANGELOG.md", "CITATION.cff", "SECURITY.md", "LICENSE",
        "docs/decisions/0001-code-and-evidence-in-level-folders.md",
        "docs/decisions/0002-simulation-without-a-cluster.md",
        "level-1-learn/README.md", "level-2-build/README.md", "level-3-deep/README.md",
        "level-2-build/BUILD-SPEC.md", "level-3-deep/DEEP-SPEC.md",
        "level-1-learn/results_learn.json", "level-2-build/results_build.json", "level-3-deep/results_deep.json"]
GRADE = re.compile(r"of 10,?000|/ ?10,?000|/1000\b|\bGrade:|^#+ .*\bGrades?\b|\bgrades? on record"
                   r"|\bgrade [\d,]+|\d+(\.\d+)? of 10\b", re.I | re.M)


def public_files():
    out = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True).stdout.split()
    if not out:  # not a git checkout: walk the tree
        out = [os.path.relpath(os.path.join(d, f), ROOT) for d, _, fs in os.walk(ROOT)
               if ".git" not in d and "node_modules" not in d for f in fs]
    return [p for p in out if p.endswith((".md", ".jsx", ".js", ".mjs", ".html", ".cff"))
            and "node_modules" not in p]


def test_required_files_exist():
    missing = [p for p in NEED if not os.path.exists(os.path.join(ROOT, p))]
    assert not missing, "missing files: " + ", ".join(missing)


def test_grade_pattern_catches_grades():
    for bad in ("Learn 8,700 of 10,000", "Grade: P20 Deep", "## Grade", "| Total /1000 |", "Grades on record",
                "Deep grade 8,200", "about 5.5 of 10 after it"):
        assert GRADE.search(bad), bad
    for ok in ("routing 10 requests at 5 per endpoint", "10 pods created", "200 runs x 25 steps",
               "cluster_upgrade: upgrade,"):
        assert not GRADE.search(ok), ok


def test_no_public_grade():
    hits = []
    for p in public_files():
        for i, line in enumerate(open(os.path.join(ROOT, p), encoding="utf-8"), 1):
            if GRADE.search(line):
                hits.append(f"{p}:{i}: {line.strip()}")
    assert not hits, "grades are internal only:\n" + "\n".join(hits)


def test_readme_abstract():
    text = " ".join(open(os.path.join(ROOT, "README.md"), encoding="utf-8").read().split())
    for key in ("**Question.**", "**Headline.**", "**Field.**", "**Job family.**", "**Verdict.**",
                "## Reproduce", "## Lifecycle", "## Layout"):
        assert key in text, key
    for stage in ("Question", "Proposal", "Baseline", "Build", "Evaluate", "Report", "Review", "Release"):
        assert re.search(r"- " + stage + r": (DONE|OPEN|IN PROGRESS)", text), stage


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
    print("layout and no-grade check: PASS")
