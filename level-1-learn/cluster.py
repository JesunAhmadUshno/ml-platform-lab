"""A tiny simulated Kubernetes cluster for teaching, stdlib only.

This is a teaching model, not a real cluster. No kind, k3d, or cloud
cluster is contacted. The model keeps exactly the four core objects the
SPEC Learn scope names (Pod, Deployment, Service, ConfigMap) plus the
Node a pod lands on, and implements the smallest honest version of each
object's control loop:

- Pod: one unit of work with cpu and memory requests and labels.
- Deployment: keeps a declared number of pod replicas alive. Delete a
  pod and reconcile creates a replacement with the next counter name.
- Service: a stable name and port whose endpoints are the Running pods
  matching its label selector. Requests route round robin.
- ConfigMap: key and value config. A pod snapshots the config at
  creation time, so editing a ConfigMap does not change a running pod.
  The new value reaches a pod only when that pod is recreated. This is
  the single most surprising fact for new platform operators, so the
  Learn scenario proves it with a rollout of one pod.

Scheduling rule (documented, deterministic): a pod is placed on the
node with the lowest cpu utilisation (used cpu divided by capacity)
among nodes that still fit its cpu and memory requests, with ties
broken by node name. A pod that fits nowhere stays Pending with a
named reason. All iteration is over sorted names, so two runs of the
same scenario produce identical results.
"""


class Node:
    def __init__(self, name, cpu_m, mem_mib):
        self.name = name
        self.cpu_m = cpu_m
        self.mem_mib = mem_mib


class ConfigMap:
    def __init__(self, name, data):
        self.name = name
        self.data = dict(data)


class Pod:
    def __init__(self, name, labels, cpu_m, mem_mib, owner=None, config=None):
        self.name = name
        self.labels = dict(labels)
        self.cpu_m = cpu_m
        self.mem_mib = mem_mib
        self.owner = owner
        self.config = dict(config) if config else {}
        self.status = "Pending"
        self.node = None
        self.reason = None


class Deployment:
    def __init__(self, name, replicas, labels, cpu_m, mem_mib, configmap=None):
        self.name = name
        self.replicas = replicas
        self.labels = dict(labels)
        self.cpu_m = cpu_m
        self.mem_mib = mem_mib
        self.configmap = configmap
        self.counter = 0


class Service:
    def __init__(self, name, selector, port, target_port):
        self.name = name
        self.selector = dict(selector)
        self.port = port
        self.target_port = target_port


class Cluster:
    def __init__(self):
        self.nodes = {}
        self.configmaps = {}
        self.pods = {}
        self.deployments = {}
        self.services = {}

    def add_node(self, node):
        self.nodes[node.name] = node

    def add_configmap(self, configmap):
        self.configmaps[configmap.name] = configmap

    def update_configmap(self, name, key, value):
        self.configmaps[name].data[key] = value

    def config_snapshot(self, deployment):
        if deployment.configmap is None:
            return {}
        return dict(self.configmaps[deployment.configmap].data)

    def node_usage(self, node_name):
        cpu = 0
        mem = 0
        names = []
        for pod in self.pods.values():
            if pod.status == "Running" and pod.node == node_name:
                cpu += pod.cpu_m
                mem += pod.mem_mib
                names.append(pod.name)
        return {"cpu_m": cpu, "mem_mib": mem, "pods": sorted(names)}

    def schedule(self, pod):
        best = None
        best_key = None
        for name in sorted(self.nodes):
            node = self.nodes[name]
            usage = self.node_usage(name)
            if usage["cpu_m"] + pod.cpu_m > node.cpu_m:
                continue
            if usage["mem_mib"] + pod.mem_mib > node.mem_mib:
                continue
            key = (usage["cpu_m"] / node.cpu_m, name)
            if best_key is None or key < best_key:
                best_key = key
                best = name
        if best is None:
            pod.status = "Pending"
            pod.node = None
            pod.reason = "Insufficient cpu or memory on every node"
            return pod
        pod.status = "Running"
        pod.node = best
        pod.reason = None
        return pod

    def create_pod(self, name, labels, cpu_m, mem_mib, owner=None, config=None):
        pod = Pod(name, labels, cpu_m, mem_mib, owner=owner, config=config)
        self.pods[name] = pod
        return self.schedule(pod)

    def delete_pod(self, name):
        pod = self.pods[name]
        pod.status = "Deleted"
        pod.node = None
        return pod

    def live_pods(self, deployment_name):
        return [p for p in self.pods.values()
                if p.owner == deployment_name and p.status != "Deleted"]

    def apply_deployment(self, deployment):
        self.deployments[deployment.name] = deployment
        return self.reconcile(deployment.name)

    def reconcile(self, deployment_name):
        dep = self.deployments[deployment_name]
        created = []
        live = self.live_pods(deployment_name)
        while len(live) < dep.replicas:
            name = dep.name + "-" + str(dep.counter)
            dep.counter += 1
            pod = self.create_pod(name, dep.labels, dep.cpu_m, dep.mem_mib,
                                  owner=dep.name,
                                  config=self.config_snapshot(dep))
            created.append(pod.name)
            live = self.live_pods(deployment_name)
        return created

    def scale(self, deployment_name, replicas):
        dep = self.deployments[deployment_name]
        dep.replicas = replicas
        created = self.reconcile(deployment_name)
        live = sorted(self.live_pods(deployment_name), key=lambda p: p.name)
        removed = []
        while len(live) > replicas:
            victim = live.pop()
            self.delete_pod(victim.name)
            removed.append(victim.name)
        return {"created": created, "removed": removed}

    def add_service(self, service):
        self.services[service.name] = service

    def endpoints(self, service_name):
        svc = self.services[service_name]
        out = []
        for pod in self.pods.values():
            if pod.status != "Running":
                continue
            if all(pod.labels.get(k) == v for k, v in svc.selector.items()):
                out.append(pod.name)
        return sorted(out)

    def route_requests(self, service_name, count):
        eps = self.endpoints(service_name)
        counts = {name: 0 for name in eps}
        if not eps:
            return counts
        for i in range(count):
            counts[eps[i % len(eps)]] += 1
        return counts
