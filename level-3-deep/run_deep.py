"""Deep runner: the designed operator scenario over the simulation.

Simulated and labelled as such: no real cluster, operator, or
upgrade is contacted or run. The scenario is defined in
DEEP-SPEC.md and every number is hand-computed there and asserted
in tests/test_deep_platform.py.

Order:
1. Apply ModelEndpoint chat-endpoint at v1, reconcile (pass 1).
2. Reconcile again with no change (pass 2, idempotence).
3. Upgrade the declared version to v2, reconcile (pass 3).
4. Inject drift outside the controller: delete one pod, tamper one
   pod back to v1, add one extra pod. Reconcile (pass 4).
5. Run the simulated cluster upgrade from 1.29 to 1.30.
6. Attach the modelled, illustrative cost figures.

Run: python3 run_deep.py writes results_deep.json beside this file.
Deterministic: no wall-clock fields, two runs are identical.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from deep_operator import ClusterUpgrade, Controller, DrillNode, EndpointPod, ModelEndpoint, cost_model  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))


def build_scenario():
    ep = ModelEndpoint("chat-endpoint", "team-serve", "tiny-gpt",
                       "v1", 3, 500, 1024)
    ctl = Controller(ep)

    pass1 = ctl.reconcile()
    state_after_pass1 = ctl.live_state()
    pass2 = ctl.reconcile()
    ctl.set_version("v2")
    pass3 = ctl.reconcile()
    state_after_pass3 = ctl.live_state()

    # Drift injection, outside the controller and not logged as
    # controller actions: one pod deleted, one pod tampered back
    # to v1, one extra pod added.
    del ctl.pods["chat-endpoint-1"]
    ctl.pods["chat-endpoint-2"].version = "v1"
    ctl.pods["chat-endpoint-99"] = EndpointPod(
        "chat-endpoint-99", "v2", 500, 1024)
    state_before_pass4 = ctl.live_state()
    pass4 = ctl.reconcile()
    final_pods = ctl.live_state()

    nodes = [DrillNode("cp-0", "1.29"), DrillNode("worker-0", "1.29"),
             DrillNode("worker-1", "1.29")]
    upgrade = ClusterUpgrade("1.29", nodes, "1.30",
                             ctl.healthy()).run_upgrade()

    def counts(actions):
        out = {"create": 0, "replace": 0, "delete": 0}
        for a in actions:
            out[a["action"]] += 1
        return out

    total = counts(ctl.action_log)
    running = [p for p in final_pods if p["status"] == "Running"]
    results = {
        "project": "P20 ml-platform-lab",
        "level": "Deep",
        "simulated": True,
        "note": ("Deep-level simulation on the Muse VM. No real "
                 "cluster, operator, CRD application, or version "
                 "upgrade was contacted or run. The endpoint, the "
                 "controller, the drill cluster, and its upgrade "
                 "are simulated objects, labelled as such. Cost "
                 "figures are modelled and illustrative only, with "
                 "invented unit prices; no real cloud price and no "
                 "real spend is claimed."),
        "endpoint_spec": ep.spec_dict(),
        "pass_actions": {
            "pass1": pass1, "pass2": pass2, "pass3": pass3,
            "pass4": pass4,
        },
        "action_counts_by_pass": {
            "pass1": counts(pass1), "pass2": counts(pass2),
            "pass3": counts(pass3), "pass4": counts(pass4),
        },
        "state_after_pass1": state_after_pass1,
        "state_after_pass3": state_after_pass3,
        "state_before_pass4": state_before_pass4,
        "version_upgrade_log": ctl.version_log,
        "action_log": ctl.action_log,
        "final_pods": final_pods,
        "endpoint_healthy_final": ctl.healthy(),
        "cluster_upgrade": upgrade,
        "cost_model": cost_model(),
        "summary": {
            "reconcile_passes": ctl.pass_count,
            "total_actions": len(ctl.action_log),
            "creates": total["create"],
            "replaces": total["replace"],
            "deletes": total["delete"],
            "version_log_entries": len(ctl.version_log),
            "final_declared_version": ep.version,
            "final_pods": len(final_pods),
            "final_pods_at_declared": len(
                [p for p in final_pods
                 if p["version"] == ep.version]),
            "final_running_cpu_m": sum(p["cpu_req_m"] for p in running),
            "final_running_mem_mib": sum(p["mem_req_mib"]
                                         for p in running),
            "cluster_from_version": upgrade["from_version"],
            "cluster_to_version": upgrade["to_version"],
            "cluster_upgrade_steps": len(upgrade["steps"]),
            "cluster_pre_checks_passed": len(
                [c for c in upgrade["pre_checks"] if c["pass"]]),
            "cluster_post_checks_passed": len(
                [c for c in upgrade["post_checks"] if c["pass"]]),
            "rollback_triggered": upgrade["rollback_triggered"],
            "modelled_total_usd_per_month":
                cost_model()["total_modelled_usd_per_month"],
        },
    }
    return results


def main():
    results = build_scenario()
    out = os.path.join(HERE, "results_deep.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2, sort_keys=True)
        fh.write("\n")
    print("summary:", results["summary"])
    print("wrote", out)


if __name__ == "__main__":
    main()
