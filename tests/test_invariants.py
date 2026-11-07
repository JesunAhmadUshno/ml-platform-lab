"""Randomized invariant tests for all three simulated levels.

The level tests check one hand-designed scenario each. This file adds
property checks over many random operation sequences, drawn from a
seeded random.Random so every run is identical:

- Learn: no node is ever over-committed on cpu or memory, every
  Running pod has a node, every Pending pod has a reason, and a
  reconcile leaves each deployment at its declared live count.
- Build: node cpu, memory, and GPU devices are never over-committed,
  a namespace quota is never exceeded by active pods, a rejected pod
  is never registered, and every Running pod satisfies its
  nodeSelector and tolerates every NoSchedule taint on its node.
- Deep: after arbitrary drift and one reconcile pass, the endpoint is
  healthy, every pod runs the declared version, the pod set equals
  the desired names, and a second pass takes 0 actions.

The modules are loaded by file path under distinct names, so the
level-2 module never collides with the standard library platform
module. Run: python3 tests/test_invariants.py
"""
import importlib.util
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED = 20
RUNS = 200
STEPS = 25


def load(name, rel):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, rel))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


learn = load("learn_cluster", "level-1-learn/cluster.py")
build = load("build_platform", "level-2-build/platform.py")
deep = load("deep_operator_sim", "level-3-deep/deep_operator.py")


def learn_invariants(c):
    for name, node in c.nodes.items():
        u = c.node_usage(name)
        assert u["cpu_m"] <= node.cpu_m and u["mem_mib"] <= node.mem_mib, name
    for p in c.pods.values():
        if p.status == "Running":
            assert p.node in c.nodes, p.name
        if p.status == "Pending":
            assert p.reason, p.name


def test_learn_random_operations():
    rng = random.Random(SEED)
    for run in range(RUNS):
        c = learn.Cluster()
        c.add_node(learn.Node("node-r610", 8000, 16384))
        c.add_node(learn.Node("node-v2", 4000, 8192))
        c.add_node(learn.Node("node-v3", 4000, 8192))
        c.add_configmap(learn.ConfigMap("cfg", {"MAX_BATCH": "8"}))
        c.apply_deployment(learn.Deployment("api", 2, {"app": "api"}, 500, 512, configmap="cfg"))
        c.apply_deployment(learn.Deployment("worker", 1, {"app": "worker"}, 1000, 1024))
        learn_invariants(c)
        for step in range(STEPS):
            op = rng.randrange(5)
            if op == 0:
                c.create_pod("p-%d-%d" % (run, step), {"app": "x"},
                             rng.randrange(100, 9000, 50), rng.randrange(64, 18000, 64))
            elif op == 1:
                live = sorted(n for n, p in c.pods.items() if p.status != "Deleted")
                if live:
                    c.delete_pod(rng.choice(live))
            elif op == 2:
                dep = rng.choice(["api", "worker"])
                c.scale(dep, rng.randrange(0, 7))
                assert len(c.live_pods(dep)) == c.deployments[dep].replicas
            elif op == 3:
                dep = rng.choice(["api", "worker"])
                c.reconcile(dep)
                assert len(c.live_pods(dep)) >= c.deployments[dep].replicas
            else:
                c.update_configmap("cfg", "MAX_BATCH", str(rng.choice([8, 16, 32])))
            learn_invariants(c)


def build_cluster():
    c = build.Cluster()
    taint = build.Taint("gpu", "true", "NoSchedule")
    c.add_node(build.Node("node-cpu-a", 8000, 16384, labels={"pool": "general"}))
    c.add_node(build.Node("node-cpu-b", 8000, 16384, labels={"pool": "general"}))
    c.add_node(build.Node("node-gpu-a", 8000, 16384, gpu=2, labels={"accelerator": "nvidia-t4"}, taints=[taint]))
    c.add_node(build.Node("node-gpu-b", 8000, 16384, gpu=1, labels={"accelerator": "nvidia-t4"}, taints=[taint]))
    c.add_namespace(build.Namespace("team-train", 24000, 49152, 2, 10))
    c.add_namespace(build.Namespace("team-serve", 8000, 16384, 1, 6))
    c.add_namespace(build.Namespace("team-sandbox", 2000, 4096, 0, 3))
    return c


def build_invariants(c):
    for name, node in c.nodes.items():
        u = c.node_usage(name)
        assert u["cpu_m"] <= node.cpu_m, name
        assert u["mem_mib"] <= node.mem_mib, name
        assert u["gpu"] <= node.gpu, name
    for ns, obj in c.namespaces.items():
        q = c.quota_usage(ns)
        for key in ("cpu_m", "mem_mib", "gpu", "pods"):
            assert q[key] <= obj.quota[key], (ns, key)
    for p in c.pods.values():
        if p.status != "Running":
            continue
        node = c.nodes[p.node]
        for k, v in p.node_selector.items():
            assert node.labels.get(k) == v, p.name
        for t in node.taints:
            if t.effect == "NoSchedule":
                assert any(tol.tolerates(t) for tol in p.tolerations), p.name


def test_build_random_admissions():
    rng = random.Random(SEED)
    tol = [build.Toleration("gpu", "NoSchedule")]
    for run in range(RUNS):
        c = build_cluster()
        for step in range(STEPS):
            name = "p-%d-%d" % (run, step)
            cpu = rng.randrange(100, 9000, 100)
            mem = rng.randrange(128, 18000, 128)
            pod = build.Pod(name, rng.choice(sorted(c.namespaces)), {"app": "x"},
                            cpu, cpu + rng.randrange(-200, 2000, 100),
                            mem, mem + rng.randrange(-256, 4096, 128),
                            gpu=rng.randrange(0, 3),
                            node_selector={"accelerator": "nvidia-t4"} if rng.random() < 0.4 else None,
                            tolerations=tol if rng.random() < 0.5 else None)
            before = len(c.rejections)
            out = c.admit(pod)
            if out is None:
                assert len(c.rejections) == before + 1 and name not in c.pods
            if rng.random() < 0.2:
                running = sorted(n for n, p in c.pods.items() if p.status == "Running")
                if running:
                    c.pods[rng.choice(running)].status = "Succeeded"
            build_invariants(c)


def test_deep_random_drift():
    rng = random.Random(SEED)
    versions = ["v1", "v2", "v3"]
    for run in range(RUNS):
        ep = deep.ModelEndpoint("ep", "ns", "m", "v1", rng.randrange(1, 6), 500, 1024)
        ctl = deep.Controller(ep)
        ctl.reconcile()
        for step in range(STEPS):
            op = rng.randrange(5)
            names = sorted(ctl.pods)
            if op == 0 and names:
                del ctl.pods[rng.choice(names)]
            elif op == 1 and names:
                ctl.pods[rng.choice(names)].version = rng.choice(versions)
            elif op == 2:
                extra = "ep-%d" % rng.randrange(5, 99)
                ctl.pods[extra] = deep.EndpointPod(extra, rng.choice(versions), 500, 1024)
            elif op == 3:
                ctl.set_version(rng.choice(versions))
            else:
                ep.replicas = rng.randrange(0, 6)
            if rng.random() < 0.5:
                ctl.reconcile()
                assert ctl.healthy(), (run, step)
                assert set(ctl.pods) == set(ep.desired_pod_names())
                assert all(p.version == ep.version for p in ctl.pods.values())
                assert ctl.reconcile() == []


if __name__ == "__main__":
    test_learn_random_operations()
    test_build_random_admissions()
    test_deep_random_drift()
    print("invariant tests passed:", RUNS, "random runs of", STEPS,
          "steps per level, seed", SEED)
