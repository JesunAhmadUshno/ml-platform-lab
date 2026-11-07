"""pytest support: lets `python3 -m pytest` collect the Build tests.

level-2-build/platform.py shares its module name with the standard
library platform module, which pytest has already imported before it
collects any test file. The Build test then finds the cached stdlib
module and fails with "cannot import name 'Cluster' from 'platform'".

While pytest collects tests/test_build_platform.py only, this hook
removes the cached stdlib module so the Build import resolves to
level-2-build/platform.py, then puts the stdlib module back. No level
file is renamed, and the script-style runs used by CI are unaffected.
"""
import sys

import pytest


@pytest.hookimpl(wrapper=True)
def pytest_make_collect_report(collector):
    path = getattr(collector, "path", None)
    if path is None or path.name != "test_build_platform.py":
        return (yield)
    stdlib_platform = sys.modules.pop("platform", None)
    try:
        return (yield)
    finally:
        sys.modules.pop("platform", None)
        if stdlib_platform is not None:
            sys.modules["platform"] = stdlib_platform
