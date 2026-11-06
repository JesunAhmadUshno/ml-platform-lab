"""A simulated model endpoint operator at Deep level, stdlib only.

This is a simulation, not a real operator. No Kubernetes API server,
kubectl, kind, k3d, or cloud cluster is contacted, and no real CRD
is applied anywhere. The model implements, inside the labelled
simulation carried from Learn and Build:

- one CRD object (ModelEndpoint) declaring a model, a version, a
  replica count, and per-pod resource requests,
- a controller whose reconcile pass keeps the live pod set at the
  declared version: missing pods are created, wrong-version pods
  are replaced, extra pods are deleted, correct pods are kept,
- a version upgrade log with one entry per declared version change,
- a simulated cluster version upgrade with pre-checks, an ordered
  step list, post-checks, and a rollback note,
- a cost model whose figures are modelled and illustrative only.

All rules are deterministic (see DEEP-SPEC.md): iteration is over
sorted pod and node names, action sequence numbers are assigned in
log order, and no result carries a wall-clock field, so two runs of
the scenario produce a byte-identical results_deep.json.
"""


class ModelEndpoint:
    """The CRD object: a declared model endpoint."""

    def __init__(self, name, namespace, model, version, replicas,
                 cpu_req_m, mem_req_mib):
        self.name = name
        self.namespace = namespace
        self.model = model
        self.version = version
        self.replicas = replicas
        self.cpu_req_m = cpu_req_m
        self.mem_req_mib = mem_req_mib

    def desired_pod_names(self):
        return [self.name + "-" + str(i) for i in range(self.replicas)]

    def spec_dict(self):
        return {
            "name": self.name, "namespace": self.namespace,
            "model": self.model, "declared_version": self.version,
            "replicas": self.replicas, "cpu_req_m": self.cpu_req_m,
            "mem_req_mib": self.mem_req_mib,
        }


class EndpointPod:
    def __init__(self, name, version, cpu_req_m, mem_req_mib):
        self.name = name
        self.version = version
        self.cpu_req_m = cpu_req_m
        self.mem_req_mib = mem_req_mib
        self.status = "Running"


class Controller:
    """Keeps one ModelEndpoint at its declared version."""

    def __init__(self, endpoint):
        self.endpoint = endpoint
        self.pods = {}
        self.action_log = []
        self.version_log = []
        self.pass_count = 0

    def _log(self, action, pod_name, from_version, to_version):
        self.action_log.append({
            "seq": len(self.action_log) + 1,
            "pass": self.pass_count,
            "action": action,
            "pod": pod_name,
            "from_version": from_version,
            "to_version": to_version,
        })

    def set_version(self, new_version):
        old = self.endpoint.version
        self.endpoint.version = new_version
        self.version_log.append({
            "endpoint": self.endpoint.name,
            "from_version": old,
            "to_version": new_version,
        })

    def reconcile(self):
        """One reconcile pass. Returns the actions taken this pass."""
        self.pass_count += 1
        before = len(self.action_log)
        ep = self.endpoint
        desired = ep.desired_pod_names()
        for name in desired:
            pod = self.pods.get(name)
            if pod is None:
                self.pods[name] = EndpointPod(
                    name, ep.version, ep.cpu_req_m, ep.mem_req_mib)
                self._log("create", name, None, ep.version)
            elif pod.version != ep.version:
                old = pod.version
                self.pods[name] = EndpointPod(
                    name, ep.version, ep.cpu_req_m, ep.mem_req_mib)
                self._log("replace", name, old, ep.version)
        for name in sorted(list(self.pods)):
            if name not in desired:
                old = self.pods[name].version
                del self.pods[name]
                self._log("delete", name, old, None)
        return self.action_log[before:]

    def live_state(self):
        pods = []
        for name in sorted(self.pods):
            p = self.pods[name]
            pods.append({
                "name": p.name, "version": p.version,
                "status": p.status, "cpu_req_m": p.cpu_req_m,
                "mem_req_mib": p.mem_req_mib,
            })
        return pods

    def healthy(self):
        ep = self.endpoint
        if len(self.pods) != ep.replicas:
            return False
        return all(self.pods[n].version == ep.version
                   and self.pods[n].status == "Running"
                   for n in ep.desired_pod_names()
                   if n in self.pods) and set(self.pods) == set(
                       ep.desired_pod_names())


class DrillNode:
    def __init__(self, name, kubelet_version, ready=True):
        self.name = name
        self.kubelet_version = kubelet_version
        self.ready = ready


class ClusterUpgrade:
    """A simulated Kubernetes version upgrade of the drill cluster."""

    def __init__(self, control_plane_version, nodes, target_version,
                 endpoint_healthy):
        self.control_plane_version = control_plane_version
        self.nodes = {n.name: n for n in nodes}
        self.target_version = target_version
        self.endpoint_healthy = endpoint_healthy

    def run_upgrade(self):
        start = self.control_plane_version
        target = self.target_version
        node_names = sorted(self.nodes)
        pre_checks = [
            {"name": "control plane at start version",
             "pass": self.control_plane_version == start},
            {"name": "all nodes Ready",
             "pass": all(self.nodes[n].ready for n in node_names)},
            {"name": "kubelet skew within one minor",
             "pass": all(self.nodes[n].kubelet_version == start
                         for n in node_names)},
            {"name": "endpoint healthy before upgrade",
             "pass": self.endpoint_healthy},
        ]
        steps = ["pre-checks complete",
                 "backup etcd snapshot (simulated)",
                 "upgrade control plane cp-0 from " + start
                 + " to " + target,
                 "upgrade kubelet on cp-0 from " + start
                 + " to " + target]
        self.control_plane_version = target
        self.nodes["cp-0"].kubelet_version = target
        for worker in ["worker-0", "worker-1"]:
            steps.append("drain " + worker)
            steps.append("upgrade kubelet on " + worker + " from "
                         + start + " to " + target)
            self.nodes[worker].kubelet_version = target
            steps.append("uncordon " + worker)
        steps.append("post-checks complete")
        post_checks = [
            {"name": "control plane at target version",
             "pass": self.control_plane_version == target},
            {"name": "all kubelets at target version",
             "pass": all(self.nodes[n].kubelet_version == target
                         for n in node_names)},
            {"name": "all nodes Ready",
             "pass": all(self.nodes[n].ready for n in node_names)},
            {"name": "endpoint still healthy",
             "pass": self.endpoint_healthy},
        ]
        all_pass = (all(c["pass"] for c in pre_checks)
                    and all(c["pass"] for c in post_checks))
        return {
            "simulated": True,
            "from_version": start,
            "to_version": target,
            "pre_checks": pre_checks,
            "steps": steps,
            "post_checks": post_checks,
            "rollback_triggered": False,
            "rollback_note": (
                "No rollback was needed: every post-check passed. "
                "If a post-check had failed, the simulated rollback "
                "would restore the etcd snapshot taken in step 2, "
                "return the control plane to " + start + ", and "
                "re-run the pre-checks before any second attempt. "
                "This note describes the simulated procedure only; "
                "no real rollback was performed."),
            "status": "Succeeded" if all_pass else "Failed",
            "final_control_plane_version": self.control_plane_version,
            "final_kubelet_versions": {
                n: self.nodes[n].kubelet_version for n in node_names},
        }


def cost_model():
    """Modelled, illustrative cost figures. Not real prices."""
    nodes = 3
    per_node = 40
    node_total = nodes * per_node
    storage = 10
    return {
        "label": "modelled, illustrative only - not real cloud "
                 "prices and not real spend",
        "assumptions": {
            "nodes": nodes,
            "modelled_usd_per_node_per_month": per_node,
            "modelled_storage_usd_per_month": storage,
            "endpoint_pods_share_node_cost": True,
        },
        "node_cost_usd_per_month": node_total,
        "storage_cost_usd_per_month": storage,
        "total_modelled_usd_per_month": node_total + storage,
    }
