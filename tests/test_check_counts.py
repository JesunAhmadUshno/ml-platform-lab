"""Check-count consistency test.

Runs each level test script and confirms that the number of passing
checks it prints ("ok ..." lines) equals the number of check( call
sites in the file. The live dashboard derives its check count from
the same call sites at build time (site/src/checkCount.mjs uses the
same pattern), so this test keeps the published figure tied to what
the scripts actually run. Run: python3 tests/test_check_counts.py
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = ["test_learn_platform.py", "test_build_platform.py",
           "test_deep_platform.py"]
CALL = re.compile(r"^\s*check\(", re.M)


def static_count(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as fh:
        return len(CALL.findall(fh.read()))


def run_count(name):
    out = subprocess.run([sys.executable, os.path.join(HERE, name)],
                         capture_output=True, text=True, check=True).stdout
    return sum(1 for line in out.splitlines() if line.startswith("ok "))


def test_printed_checks_match_call_sites():
    for name in SCRIPTS:
        assert run_count(name) == static_count(name), name


if __name__ == "__main__":
    test_printed_checks_match_call_sites()
    counts = {name: static_count(name) for name in SCRIPTS}
    print("check counts match call sites:", counts,
          "total", sum(counts.values()))
