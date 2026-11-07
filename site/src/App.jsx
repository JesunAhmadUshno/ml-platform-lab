import { useMemo, useState, useEffect, useId, useCallback } from 'react';
import learnJson from '../../level-1-learn/results_learn.json';
import buildJson from '../../level-2-build/results_build.json';
import deepJson from '../../level-3-deep/results_deep.json';
import roadmapMd from '../../ROADMAP.md?raw';
import noveltyMd from '../../NOVELTY.md?raw';
import docsIndexMd from '../../docs/index.md?raw';
import learnReadme from '../../level-1-learn/README.md?raw';
import buildReadme from '../../level-2-build/README.md?raw';
import deepReadme from '../../level-3-deep/README.md?raw';
import {
  replayLearn, learnBase, learnPodsFinal, LEARN_NODES, buildScenario, podFromSpec, BUILD_PROBES, BUILD_NODES,
  applyDeep, DEEP_SCRIPT, countActs, deep, drillNodes, costModel, fuzz,
} from './sim.js';

const REPO = 'https://github.com/JesunAhmadUshno/ml-platform-lab';
const blob = (p) => `${REPO}/blob/main/${p}`;
const fmt = (n) => Number(n).toLocaleString('en-US');
// Order-insensitive deep equality, so live JS objects can be compared with the sorted-key JSON files.
const eq = (a, b) => {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => eq(a[k], b[k]));
};
const CHECKS = __CHECK_COUNTS__; // derived from the check( call sites in tests/ at build time
const CHECK_TOTAL = Object.values(CHECKS).reduce((s, v) => s + v, 0);

// Markdown sections read from the repo at build time.
const section = (md, head) => { const i = md.indexOf(head); if (i < 0) return ''; const rest = md.slice(i + head.length); const j = rest.search(/\n## /); return (j < 0 ? rest : rest.slice(0, j)).trim(); };
const oneLine = (s) => s.replace(/\s*\n\s*/g, ' ').trim();
const ROADMAP_ITEMS = section(roadmapMd, '## v1.1 backlog (named, not built)').split(/\n(?=\d+\. )/).map((s) => oneLine(s.replace(/^\d+\.\s*/, ''))).filter(Boolean);
const NOVELTY_STATUS = (noveltyMd.match(/^Status: (.*)$/m) || [])[1] || '';
const GRADES_LINE = (docsIndexMd.match(/^Grades on record.*$/m) || [])[0] || '';
const DEEP_FAILURES = section(deepReadme, '## Failure modes').split(/\n- /).map((s) => oneLine(s.replace(/^- /, ''))).filter(Boolean).map((s) => { const k = s.indexOf(':'); return { title: s.slice(0, k), body: s.slice(k + 1).trim() }; });
const LEARN_BREAKS = [...learnReadme.matchAll(/### (\w+)\nWhat it is:[\s\S]*?What breaks without it: ([\s\S]*?)\n(?:In the scenario|The sharp edge)/g)].map((m) => ({ title: m[1], body: oneLine(m[2]) }));
const NOT_DONE = [['Learn', learnReadme], ['Build', buildReadme], ['Deep', deepReadme]].map(([l, md]) => [l, oneLine(section(md, '## What this level does not do'))]);

const SECTIONS = [['top', 'Overview', '◎'], ['learn', 'Scheduler', '▦'], ['build', 'Admission', '⛨'], ['operator', 'Operator', '↻'], ['upgrade', 'Upgrade', '⇡'], ['cost', 'Cost', '$'], ['explorer', 'Recorded', '▤'], ['fuzz', 'Invariants', '✓'], ['failures', 'Failures', '!'], ['method', 'Method', '❯_']];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

function MenuBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return (
    <div className="menubar" role="banner">
      <span className="apple" aria-hidden="true">◆</span>
      <a className="app" href="#top">cluster.app</a>
      <a className="m" href={blob('SPEC.md')}>Spec</a>
      <a className="m" href={blob('ROADMAP.md')}>Roadmap</a>
      <a className="m" href={blob('docs/research-review.md')}>Research review</a>
      <span className="spacer" />
      <span className="status"><i className="sim" /> Simulation · CI reproducible</span>
      <a href={REPO}>GitHub ↗</a>
      <span className="clock">{now.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
    </div>
  );
}

function Dock() {
  const [active, setActive] = useState('top');
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: '-45% 0px -50% 0px' });
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  return (
    <nav className="dock" aria-label="Sections">
      {SECTIONS.map(([id, label, icon]) => (
        <a key={id} href={`#${id}`} className={active === id ? 'on' : ''} aria-current={active === id ? 'true' : undefined}>
          <span className="ico" aria-hidden="true">{icon}</span><span className="lbl">{label}</span>
        </a>
      ))}
    </nav>
  );
}

function Range({ label, value, min, max, step, onChange, show }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label} <span>{show ?? value}</span></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

function Select({ label, value, options, onChange }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}
      </select>
    </div>
  );
}

function Check({ label, checked, onChange }) {
  const id = useId();
  return <label className="check" htmlFor={id}><input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
}

const Pill = ({ ok, yes, no, warn }) => <span className={`pill ${ok ? 'good' : warn ? 'warn' : 'bad'}`}>● {ok ? yes : no}</span>;

// Horizontal capacity bars, one row per node, segments per pod.
function CapacityBars({ title, nodes, resource, unit, colorOf }) {
  const W = 440, rowH = 30, L = 84, R = 92, H = nodes.length * rowH + 4;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
      {nodes.map((n, i) => {
        const y = i * rowH + 6, scale = (W - L - R) / n.cap; let x = L;
        return (
          <g key={n.name}>
            <text x={0} y={y + 13} style={{ fill: 'var(--text)' }}>{n.name}</text>
            <rect x={L} y={y} width={W - L - R} height={18} rx={5} fill="var(--primary-pale)" />
            {n.pods.filter((p) => p[resource] > 0).map((p) => { const w = p[resource] * scale; const r = <rect key={p.name} x={x} y={y} width={Math.max(0, w - 1)} height={18} rx={4} fill={colorOf(p)}><title>{`${p.name}: ${fmt(p[resource])} ${unit}`}</title></rect>; x += w; return r; })}
            <text x={W - R + 6} y={y + 13}>{fmt(n.used)}/{fmt(n.cap)}</text>
          </g>
        );
      })}
    </svg>
  );
}

const OWNER_COLORS = { api: 'var(--primary)', worker: '#b7791f', debug: '#7c5cbf', 'serve-plain': '#2f855a', 'serve-kserve': '#2b6cb0', mine: 'var(--bad)' };
const ownerColor = (p) => OWNER_COLORS[p.owner] || (p.kind === 'job' ? '#b7791f' : 'var(--muted)');

/* ================================ App ================================ */
export default function App() {
  useReveal();
  const [learnOps, setLearnOps] = useState([{ t: 'replay' }]);
  const [buildSpec, setBuildSpec] = useState({ ...BUILD_PROBES[2], stage: 'admission' });
  const [deepOps, setDeepOps] = useState(DEEP_SCRIPT);
  const [healthy, setHealthy] = useState(deepJson.endpoint_healthy_final);
  const go = useCallback((id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), []);
  return (
    <div className="wrap">
      <MenuBar />
      <div className="glow" aria-hidden="true" />
      <Hero />
      <Learn ops={learnOps} setOps={setLearnOps} />
      <Admission spec={buildSpec} setSpec={setBuildSpec} />
      <Jobs />
      <Serving />
      <Operator ops={deepOps} setOps={setDeepOps} />
      <Upgrade healthy={healthy} setHealthy={setHealthy} />
      <Cost />
      <Explorer />
      <Fuzz />
      <Failures act={{ setLearnOps, setBuildSpec, setDeepOps, setHealthy, go }} />
      <Method />
      <Dock />
      <footer>
        Code: Apache-2.0. Every number on this page is read from <code>level-*/results_*.json</code>, the repo docs, or <code>tests/</code> at build time, or computed live in your browser by JavaScript ports of the repo&apos;s simulators. Nothing here is a real cluster.
      </footer>
    </div>
  );
}

/* ================================ Hero ================================ */
function Hero() {
  const L = learnJson.summary, B = buildJson.summary, D = deepJson.summary;
  return (
    <header className="card hero window" id="top" data-title="cluster.app — README.md">
      <div className="head">
        <p className="eyebrow">ml-platform-lab · Learn, Build, Deep</p>
        <span className="pill warn">● Simulated, no real cluster</span>
      </div>
      <h1>A Kubernetes ML platform you can <em>run in your browser</em>.</h1>
      <p className="sub">
        The same scheduler, quota and operator rules as the repo&apos;s Python simulations, ported to JavaScript and checked at build time against all three committed results files.
        The {fmt(CHECK_TOTAL)} hand-computed checks in <code>tests/</code> guard the Python; the build gate guards this page.
      </p>
      <div className="sim-banner" role="note" aria-label="Simulation notice">
        <p className="sim-title">SIMULATION. No real cluster, kubectl, container or GPU was contacted.</p>
        <ul>
          {[['Learn', learnJson.note], ['Build', buildJson.note], ['Deep', deepJson.note]].map(([l, n]) => <li key={l}><b>{l}:</b> <q>{n}</q></li>)}
        </ul>
        <p className="hint" style={{ margin: 0 }}>Quoted from the <code>note</code> field of each <code>results_*.json</code>.</p>
      </div>
      <div className="actions">
        <a className="btn primary" href="#learn">Open the scheduler playground</a>
        <a className="btn ghost" href="#operator">Step the operator</a>
      </div>
      <div className="tiles">
        <div className="tile"><div className="num">{L.pods_created_total} pods</div><div className="cap">Learn: {L.pods_running} Running / {L.pods_pending} Pending / {L.pods_deleted} Deleted</div></div>
        <div className="tile"><div className="num">{B.pods_admitted} admitted</div><div className="cap">Build: {B.admission_rejected} quota rejections, {B.jobs_succeeded} of {buildJson.jobs.length} jobs Succeeded</div></div>
        <div className="tile"><div className="num">{D.total_actions} actions</div><div className="cap">Deep: over {D.reconcile_passes} reconcile passes, final {D.final_pods_at_declared} of {D.final_pods} pods at {D.final_declared_version}</div></div>
        <div className="tile"><div className="num">{CHECK_TOTAL}</div><div className="cap">CI-verified check count ({Object.entries(CHECKS).map(([k, v]) => `${v} ${k}`).join(' + ')}), counted from <code>tests/</code> at build time</div></div>
      </div>
    </header>
  );
}

/* ================================ Learn ================================ */
function applyLearn(ops) {
  let c = null, made = 0;
  for (const o of ops) {
    if (o.t === 'replay') c = replayLearn().cluster;
    else if (o.t === 'base') c = learnBase();
    else if (o.t === 'create') c.create_pod(`pod-${made++}`, { app: 'pod' }, o.cpu, o.mem);
    else if (o.t === 'delete') c.delete_pod(o.name);
    else if (o.t === 'scale') c.scale(o.dep, o.n);
    else if (o.t === 'reconcile') c.reconcile(o.dep);
    else if (o.t === 'config') c.update_configmap('api-config', 'MAX_BATCH', o.v);
  }
  return c;
}

function Learn({ ops, setOps }) {
  const c = useMemo(() => applyLearn(ops), [ops]);
  const [cpu, setCpu] = useState(1000);
  const [mem, setMem] = useState(1024);
  const [n, setN] = useState(6);
  const pods = learnPodsFinal(c);
  const live = pods.filter((p) => p.status !== 'Deleted').map((p) => p.name);
  const [victim, setVictim] = useState('');
  const target = live.includes(victim) ? victim : live[0] || '';
  const push = (o) => setOps((prev) => {
    const last = prev[prev.length - 1];
    if (o.t === 'scale' && last?.t === 'scale' && last.dep === o.dep) return [...prev.slice(0, -1), o];
    return [...prev, o];
  });
  const isStudy = ops.length === 1 && ops[0].t === 'replay';
  const matches = isStudy && eq(pods, learnJson.pods_final);
  const maxBatch = c.configmaps.get('api-config').data.MAX_BATCH;
  const apiRunning = pods.filter((p) => p.owner === 'api' && p.status === 'Running');
  const stale = apiRunning.filter((p) => p.max_batch !== maxBatch).length;
  const routing = c.route_requests('api-svc', n);
  const nodes = LEARN_NODES.map(([name, cpuCap, memCap]) => {
    const u = c.node_usage(name);
    return { name, cpuCap, memCap, cpuUsed: u.cpu_m, memUsed: u.mem_mib, pods: u.pods.map((p) => c.pods.get(p)) };
  });
  const deps = [...c.deployments.values()];
  const pending = pods.filter((p) => p.status === 'Pending');
  return (
    <section id="learn" className="card window reveal" data-title="cluster.py — scheduler playground (live)">
      <div className="head">
        <div>
          <p className="eyebrow">Learn · live simulation</p>
          <h2>Place pods on <em>{LEARN_NODES.length} nodes</em> with the repo&apos;s scheduling rule.</h2>
          <p className="sub">
            A pod goes to the node with the lowest cpu utilisation among nodes that still fit its cpu and memory requests, ties broken by node name. A pod that fits nowhere stays Pending.
            Node capacities are the teaching values from <a href={blob('level-1-learn/run_learn.py')}>run_learn.py</a>, not measured hardware.
          </p>
        </div>
        {matches ? <span className="pill good">● Matches results_learn.json</span> : <span className="pill info">● Your own scenario</span>}
      </div>
      <div className="actions" style={{ marginTop: 0 }}>
        <button className="btn primary" onClick={() => setOps([{ t: 'replay' }])}>Replay study scenario</button>
        <button className="btn ghost" onClick={() => setOps([{ t: 'base' }])}>Start from first apply</button>
        <span className="hint">The replay runs the run_learn.py steps and must equal results_learn.json; the build fails if it does not.</span>
      </div>
      <div className="grid2" style={{ marginTop: 18 }}>
        <div>
          <h3>Node cpu requests (m)</h3>
          <CapacityBars title="CPU requests per node against capacity" resource="cpu_m" unit="m" colorOf={ownerColor} nodes={nodes.map((x) => ({ name: x.name, cap: x.cpuCap, used: x.cpuUsed, pods: x.pods }))} />
          <h3 style={{ marginTop: 10 }}>Node memory requests (MiB)</h3>
          <CapacityBars title="Memory requests per node against capacity" resource="mem_mib" unit="MiB" colorOf={ownerColor} nodes={nodes.map((x) => ({ name: x.name, cap: x.memCap, used: x.memUsed, pods: x.pods }))} />
          <div className="legend">{['api', 'worker', 'debug'].map((k) => <span key={k}><i style={{ background: OWNER_COLORS[k] }} />{k}</span>)}<span><i style={{ background: 'var(--muted)' }} />your pods</span></div>
        </div>
        <div>
          <div className="controls" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Range label="New pod cpu request" value={cpu} min={50} max={9000} step={50} onChange={setCpu} show={`${fmt(cpu)}m`} />
            <Range label="New pod memory request" value={mem} min={64} max={16384} step={64} onChange={setMem} show={`${fmt(mem)} MiB`} />
          </div>
          <div className="actions" style={{ marginTop: 0 }}>
            <button className="btn primary" onClick={() => push({ t: 'create', cpu, mem })}>Create pod</button>
          </div>
          <div className="controls" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 14 }}>
            <Select label="Pod to delete" value={target} options={live.length ? live : ['(none)']} onChange={setVictim} />
            <div className="field"><span className="flabel">&nbsp;</span><button className="btn ghost" disabled={!target} onClick={() => push({ t: 'delete', name: target })}>Delete pod</button></div>
            {deps.map((d) => <Range key={d.name} label={`Scale ${d.name} replicas`} value={d.replicas} min={0} max={8} step={1} onChange={(v) => push({ t: 'scale', dep: d.name, n: v })} />)}
            <Select label="api-config MAX_BATCH" value={maxBatch} options={['8', '16', '32']} onChange={(v) => push({ t: 'config', v })} />
            <Range label="Requests to route via api-svc" value={n} min={1} max={30} step={1} onChange={setN} />
          </div>
          <div className="dep-status">
            {deps.map((d) => {
              const lv = c.live_pods(d.name).length;
              return (
                <div key={d.name} className="row">
                  <span><b>{d.name}</b>: {lv} of {d.replicas} live</span>
                  {lv < d.replicas ? <button className="btn ghost sm" onClick={() => push({ t: 'reconcile', dep: d.name })}>Run reconcile (self-heal)</button> : <span className="pill good">● converged</span>}
                </div>
              );
            })}
            <div className="row"><span><b>ConfigMap snapshot</b>: {stale} of {apiRunning.length} running api pods still carry an old MAX_BATCH (now {maxBatch})</span></div>
            {pending.length > 0 && <div className="row"><span><b>Pending</b>: {pending.map((p) => p.name).join(', ')}: {pending[0].reason}</span></div>}
          </div>
        </div>
      </div>
      <h3 style={{ marginTop: 18 }}>Round-robin routing of {n} requests over api-svc endpoints</h3>
      <div className="chips">{Object.entries(routing).map(([k, v]) => <span key={k} className="chip">{k}: <b>{v}</b></span>)}{!Object.keys(routing).length && <span className="hint">No Running api pods, so no endpoints.</span>}</div>
      <div className="scroll-x" style={{ marginTop: 14 }}>
        <PodTable wide rows={pods} cols={['name', 'owner', 'status', 'node', 'cpu_m', 'mem_mib', 'max_batch', 'reason']} />
      </div>
    </section>
  );
}

function PodTable({ rows, cols, wide }) {
  return (
    <table className={wide ? 'wide' : undefined}>
      <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={r.name ?? i}>{cols.map((c) => <td key={c} className={c === 'status' ? `st-${r[c]}` : ''}>{r[c] === null || r[c] === undefined ? '—' : String(r[c])}</td>)}</tr>)}</tbody>
    </table>
  );
}

/* ================================ Build: admission ================================ */
function Admission({ spec, setSpec }) {
  const set = (k) => (v) => setSpec((s) => ({ ...s, [k]: v }));
  const base = useMemo(() => buildScenario(spec.stage).cluster, [spec.stage]);
  const trial = useMemo(() => {
    const c = buildScenario(spec.stage).cluster;
    const before = c.rejections.length;
    const pod = c.admit(podFromSpec({ ...spec, name: 'my-pod', owner: 'mine' }));
    const validate = c.validate(podFromSpec(spec));
    if (pod === null) return { verdict: 'Rejected', reason: c.rejections[before].reason, validate, perNode: null };
    return { verdict: pod.status, reason: pod.reason, node: pod.node, validate, perNode: c.lastPerNode };
  }, [spec]);
  const steps = [
    ['admit', 'Pod submitted to namespace ' + spec.namespace, true],
    ['validate', trial.validate ?? 'limits at or above requests', trial.validate === null],
    ['quota', trial.verdict === 'Rejected' && trial.validate === null ? trial.reason : trial.validate ? 'not reached' : 'fits the namespace quota', trial.verdict !== 'Rejected'],
    ['schedule', trial.verdict === 'Running' ? `placed on ${trial.node}` : trial.verdict === 'Pending' ? trial.reason : 'not reached', trial.verdict === 'Running'],
  ];
  const nsList = [...base.namespaces.keys()];
  return (
    <section id="build" className="card window reveal" data-title="platform.py — GPU and quota admission lab (live)">
      <div className="head">
        <div>
          <p className="eyebrow">Build · live simulation</p>
          <h2>Every pod goes admit, validate, quota, then <em>schedule</em>.</h2>
          <p className="sub">
            Write a pod spec and submit it into the Build scenario&apos;s {BUILD_NODES.length} nodes ({BUILD_NODES.filter((n) => n[5]).length} GPU nodes tainted <code>gpu=true:NoSchedule</code> and labelled <code>accelerator=nvidia-t4</code>) and {nsList.length} quota-bound namespaces.
            The verdict is the exact string <a href={blob('level-2-build/platform.py')}>platform.py</a> produces.
          </p>
        </div>
        <div className="seg" role="group" aria-label="Cluster state">
          {[['admission', 'At admission'], ['final', 'After jobs ran']].map(([k, l]) => <button key={k} aria-pressed={spec.stage === k} onClick={() => set('stage')(k)}>{l}</button>)}
        </div>
      </div>
      <div className="presets" role="group" aria-label="Load a probe from run_build.py">
        <span className="hint">Load a run_build.py probe:</span>
        {BUILD_PROBES.map((p) => <button key={p.name} className="btn ghost sm" onClick={() => setSpec({ ...p, stage: 'admission' })}>{p.name}</button>)}
        <button className="btn ghost sm" onClick={() => setSpec((s) => ({ ...s, cpu_lim_m: Math.max(0, s.cpu_req_m - 100) }))}>limit below request</button>
      </div>
      <div className="grid2" style={{ marginTop: 14 }}>
        <div>
          <div className="controls" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Select label="Namespace" value={spec.namespace} options={nsList} onChange={set('namespace')} />
            <Range label="GPU devices" value={spec.gpu} min={0} max={3} step={1} onChange={set('gpu')} />
            <Range label="cpu request" value={spec.cpu_req_m} min={100} max={16000} step={100} onChange={set('cpu_req_m')} show={`${fmt(spec.cpu_req_m)}m`} />
            <Range label="cpu limit" value={spec.cpu_lim_m} min={0} max={16000} step={100} onChange={set('cpu_lim_m')} show={`${fmt(spec.cpu_lim_m)}m`} />
            <Range label="memory request" value={spec.mem_req_mib} min={128} max={20480} step={128} onChange={set('mem_req_mib')} show={`${fmt(spec.mem_req_mib)} MiB`} />
            <Range label="memory limit" value={spec.mem_lim_mib} min={0} max={20480} step={128} onChange={set('mem_lim_mib')} show={`${fmt(spec.mem_lim_mib)} MiB`} />
          </div>
          <div className="checks">
            <Check label="nodeSelector accelerator=nvidia-t4" checked={spec.selector} onChange={set('selector')} />
            <Check label="toleration gpu:NoSchedule" checked={spec.toleration} onChange={set('toleration')} />
          </div>
          <h3 style={{ marginTop: 20 }}>Namespace quota use before your pod (active pods: Running or Pending)</h3>
          <div className="bars quota" style={{ marginTop: 10 }}>
            {nsList.map((ns) => {
              const q = base.quota_usage(ns), quota = base.namespaces.get(ns).quota;
              return (
                <div key={ns} className="quota-row">
                  <b className="mono">{ns}</b>
                  {['cpu_m', 'mem_mib', 'gpu', 'pods'].map((k) => (
                    <div key={k} className="bar-row"><div className="lab"><span>{k}</span><b>{fmt(q[k])} / {fmt(quota[k])}</b></div>
                      <div className="track"><div className="fill" style={{ width: `${quota[k] ? Math.min(100, (q[k] / quota[k]) * 100) : q[k] ? 100 : 0}%`, background: q[k] >= quota[k] ? 'var(--bad)' : 'var(--primary)' }} /></div></div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <ol className="pipeline">
            {steps.map(([k, d, ok]) => <li key={k} className={ok ? 'ok' : d === 'not reached' ? 'skip' : 'no'}><b>{k}</b><span>{d}</span></li>)}
          </ol>
          <div className={`verdict v-${trial.verdict}`} aria-live="polite">
            <b>{trial.verdict}</b>{trial.node ? ` on ${trial.node}` : ''}
            {trial.reason && <div className="mono reason">{trial.reason}</div>}
          </div>
          {trial.perNode && (
            <div className="scroll-x"><table>
              <thead><tr><th>node</th><th>cpu util before</th><th>verdict</th></tr></thead>
              <tbody>{trial.perNode.map((r) => <tr key={r.node}><td>{r.node}</td><td>{(r.util * 100).toFixed(1)}%</td><td className={r.failures.length ? 'no' : 'ok'}>{r.failures.length ? r.failures.join('; ') : r.node === trial.node ? 'candidate, chosen' : 'candidate'}</td></tr>)}</tbody>
            </table></div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ================================ Build: jobs.log ================================ */
function Jobs() {
  const podBy = Object.fromEntries(buildJson.pods_final.map((p) => [p.name, p]));
  const total = buildJson.summary.jobs_ticks_total;
  const W = 880, L = 120, R = 10, laneH = 54, H = buildJson.jobs.length * laneH + 34;
  const x = (t) => L + (t / total) * (W - L - R);
  let t0 = 0;
  const lanes = buildJson.jobs.map((j) => {
    const per = j.ticks_total / j.attempts;
    const boxes = j.pod_names.map((pn, k) => ({ pod: podBy[pn], start: t0 + k * per, end: t0 + (k + 1) * per }));
    t0 += j.ticks_total;
    return { j, boxes };
  });
  const S = buildJson.summary;
  return (
    <section id="jobs" className="card window reveal" data-title="jobs.log — job retry timeline (recorded)">
      <div className="head">
        <div>
          <p className="eyebrow">Build · recorded scenario output, from results_build.json</p>
          <h2>{S.jobs_total_attempts} attempts, {S.jobs_total_retries} retries, {S.jobs_ticks_total} ticks.</h2>
          <p className="sub">Jobs run one after another in submission order. Each attempt is a fresh pod; a failed attempt retries while retries stay within max_retries. Attempt outcomes are declared in the job spec, so this timeline is a designed scenario, not a measurement.</p>
        </div>
      </div>
      <div className="scroll-x"><svg className="chart swim" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Swimlane of job attempts over simulated ticks">
        {Array.from({ length: total + 1 }, (_, t) => <g key={t}><line className="axis" x1={x(t)} x2={x(t)} y1={0} y2={H - 22} /><text x={x(t)} y={H - 6} textAnchor="middle">{t}</text></g>)}
        {lanes.map(({ j, boxes }, i) => (
          <g key={j.name} transform={`translate(0 ${i * laneH + 8})`}>
            <text x={0} y={18} style={{ fill: 'var(--text)', fontWeight: 600 }}>{j.name}</text>
            <text x={0} y={34}>{j.status}</text>
            {boxes.map((b, k) => (
              <g key={b.pod.name}>
                <rect x={x(b.start) + 2} y={2} width={x(b.end) - x(b.start) - 4} height={36} rx={8} fill={b.pod.status === 'Succeeded' ? 'var(--good)' : 'var(--bad)'} opacity="0.85"><title>{`${b.pod.name} on ${b.pod.node}: ${b.pod.status}${b.pod.reason ? ` (${b.pod.reason})` : ''}`}</title></rect>
                <text x={x(b.start) + 10} y={18} style={{ fill: '#fff', fontWeight: 600 }}>attempt {k + 1}</text>
                <text x={x(b.start) + 10} y={32} style={{ fill: '#fff' }}>{b.pod.node}</text>
              </g>
            ))}
          </g>
        ))}
      </svg></div>
      <div className="legend"><span><i style={{ background: 'var(--good)' }} />attempt Succeeded</span><span><i style={{ background: 'var(--bad)' }} />attempt Failed (declared failure)</span><span>x axis: simulated ticks</span></div>
    </section>
  );
}

/* ================================ Build: serving.yaml ================================ */
function Serving() {
  const { plain_service: P, kserve_style: K } = buildJson.serving_comparison;
  const [n, setN] = useState(10);
  const route = (eps) => { const c = Object.fromEntries(eps.map((e) => [e, 0])); for (let i = 0; i < n && eps.length; i++) c[eps[i % eps.length]] += 1; return c; };
  const rows = [
    ['Backing object', P.backing_object, K.backing_object],
    ['Model', P.model_declared ? 'declared' : 'not declared', K.spec.model_name],
    ['Storage URI', P.storage_uri_declared ? 'declared' : 'not declared', K.spec.storage_uri],
    ['Autoscaling bounds', P.autoscaling_bounds_declared ? 'declared' : 'not declared', `min ${K.spec.min_replicas}, max ${K.spec.max_replicas} (declared only)`],
    ['Target metric', '—', K.spec.target_metric],
    ['Endpoints', P.endpoints.join(', '), K.endpoints.join(', ')],
  ];
  const sides = [['Plain Service', P], ['KServe-style InferenceService', K]];
  return (
    <section id="serving" className="card window reveal" data-title="serving.yaml — Service vs InferenceService">
      <p className="eyebrow">Build · what each object declares</p>
      <h2>Same traffic, but only one of them <em>knows it serves a model</em>.</h2>
      <p className="sub">The comparison is about declarations, not behaviour: no autoscaler acts on the bounds in this simulation. Values from <code>serving_comparison</code> in results_build.json; routing below is the same round-robin rule, live.</p>
      <div className="scroll-x" style={{ marginTop: 14 }}>
        <table>
          <thead><tr><th>Field</th><th>Plain Service</th><th>InferenceService</th></tr></thead>
          <tbody>{rows.map(([k, a, b]) => <tr key={k}><td>{k}</td><td>{a}</td><td className="wrap-cell">{b}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="controls" style={{ marginTop: 16 }}><Range label="Requests to route" value={n} min={1} max={40} step={1} onChange={setN} /></div>
      <div className="grid2">
        {sides.map(([label, s]) => {
          const r = route(s.endpoints), rec = n === 10;
          return (
            <div key={label} className="tile">
              <div className="head" style={{ marginBottom: 6 }}><h3>{label}</h3>{rec && <Pill ok={eq(r, s.requests_routed_10)} yes="equals recorded 10-request split" no="differs from recorded" />}</div>
              <div className="chips">{Object.entries(r).map(([k, v]) => <span className="chip" key={k}>{k}: <b>{v}</b></span>)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ================================ Deep: operator ================================ */
function Operator({ ops, setOps }) {
  const { ctl, passes } = useMemo(() => applyDeep(ops), [ops]);
  const ep = ctl.endpoint;
  const live = ctl.live_state();
  const [ver, setVer] = useState('v3');
  const [sel, setSel] = useState('');
  const target = live.some((p) => p.name === sel) ? sel : live[0]?.name || '';
  const extras = ops.filter((o) => o.op === 'extra').length;
  const push = (o) => setOps((prev) => {
    const last = prev[prev.length - 1];
    if (o.op === 'replicas' && last?.op === 'replicas') return [...prev.slice(0, -1), o];
    return [...prev, o];
  });
  const ok = ctl.healthy();
  const matches = eq(ctl.action_log, deepJson.action_log) && eq(live, deepJson.final_pods);
  const other = ep.version === 'v1' ? 'v2' : 'v1';
  return (
    <section id="operator" className="card window reveal" data-title="deep_operator.py — ModelEndpoint reconcile stepper (live)">
      <div className="head">
        <div>
          <p className="eyebrow">Deep · live simulation</p>
          <h2>A controller that keeps <em>{ep.name}</em> at its declared version.</h2>
          <p className="sub">
            Each reconcile pass creates missing pods, replaces wrong-version pods and deletes extras, in name order. Drift buttons act outside the controller, exactly as run_deep.py injects it, and are not logged as controller actions.
          </p>
        </div>
        <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
          <Pill ok={ok} yes="healthy()" no="not healthy: run reconcile" />
          {matches && <span className="pill good">● Matches results_deep.json</span>}
        </div>
      </div>
      <div className="spec mono">ModelEndpoint {ep.name} · model {ep.model} · declared {ep.version} · replicas {ep.replicas} · {ep.cpu_req_m}m / {ep.mem_req_mib} MiB per pod</div>
      <div className="actions">
        <button className="btn primary" onClick={() => push({ op: 'reconcile' })}>Run reconcile</button>
        <button className="btn ghost" onClick={() => setOps(DEEP_SCRIPT)}>Replay run_deep.py</button>
        <button className="btn ghost" onClick={() => setOps([])}>Empty controller</button>
      </div>
      <div className="controls" style={{ marginTop: 16 }}>
        <Select label="Declare version" value={ver} options={['v1', 'v2', 'v3']} onChange={setVer} />
        <div className="field"><span className="flabel">&nbsp;</span><button className="btn ghost" onClick={() => push({ op: 'version', v: ver })}>Set version</button></div>
        <Range label="Declared replicas" value={ep.replicas} min={0} max={6} step={1} onChange={(v) => push({ op: 'replicas', n: v })} />
        <Select label="Drift target pod" value={target} options={live.length ? live.map((p) => p.name) : ['(none)']} onChange={setSel} />
      </div>
      <div className="actions" style={{ marginTop: 0 }}>
        <span className="hint">Inject drift:</span>
        <button className="btn ghost sm" disabled={!target} onClick={() => push({ op: 'delete', pod: target })}>Delete pod</button>
        <button className="btn ghost sm" disabled={!target} onClick={() => push({ op: 'tamper', pod: target, v: other })}>Tamper to {other}</button>
        <button className="btn ghost sm" onClick={() => push({ op: 'extra', pod: `${ep.name}-${90 + extras}` })}>Add extra pod</button>
      </div>
      <div className="chips" style={{ marginTop: 14 }}>
        {live.map((p) => <span key={p.name} className={`chip ${p.version === ep.version && ep.desired_pod_names().includes(p.name) ? 'good' : 'bad'}`}>{p.name} · {p.version}</span>)}
        {!live.length && <span className="hint">No pods. Run reconcile to create them.</span>}
      </div>
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="scroll-x">
          <h3>Actions per reconcile pass</h3>
          <table>
            <thead><tr><th>pass</th><th>create</th><th>replace</th><th>delete</th></tr></thead>
            <tbody>{passes.map((p, i) => { const c = countActs(p); return <tr key={i}><td>{i + 1}</td><td>{c.create}</td><td>{c.replace}</td><td>{c.delete}</td></tr>; })}</tbody>
          </table>
          {!passes.length && <p className="hint">No passes yet.</p>}
        </div>
        <div className="scroll-x log">
          <h3>Action log ({ctl.action_log.length})</h3>
          <table>
            <thead><tr><th>seq</th><th>pass</th><th>action</th><th>pod</th><th>from → to</th></tr></thead>
            <tbody>{ctl.action_log.map((a) => <tr key={a.seq}><td>{a.seq}</td><td>{a.pass}</td><td>{a.action}</td><td className="mono">{a.pod}</td><td>{a.from_version ?? '—'} → {a.to_version ?? '—'}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ================================ Deep: upgrade.log ================================ */
function Upgrade({ healthy, setHealthy }) {
  const up = useMemo(() => new deep.ClusterUpgrade(deepJson.cluster_upgrade.from_version, drillNodes(), deepJson.cluster_upgrade.to_version, healthy).run_upgrade(), [healthy]);
  const matches = eq(up, deepJson.cluster_upgrade);
  const CheckList = ({ title, items }) => (
    <div><h3>{title} ({items.filter((c) => c.pass).length} of {items.length} pass)</h3>
      <ul className="checklist">{items.map((c) => <li key={c.name} className={c.pass ? 'ok' : 'no'}>{c.pass ? '✓' : '✗'} {c.name}</li>)}</ul></div>
  );
  return (
    <section id="upgrade" className="card window reveal" data-title={`upgrade.log — simulated ${up.from_version} → ${up.to_version}`}>
      <div className="head">
        <div>
          <p className="eyebrow">Deep · live simulation of ClusterUpgrade.run_upgrade()</p>
          <h2>A cluster upgrade, <em>step by step</em>, with its checks.</h2>
          <p className="sub">Nothing was upgraded for real. Untick the endpoint check to see the Failed branch the repo&apos;s isolated test covers.</p>
        </div>
        <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
          <Pill ok={up.status === 'Succeeded'} yes={`status ${up.status}`} no={`status ${up.status}`} />
          {matches && <span className="pill good">● Matches results_deep.json</span>}
        </div>
      </div>
      <div className="checks"><Check label="endpoint healthy (healthy() before and after)" checked={healthy} onChange={setHealthy} /></div>
      <div className="grid3" style={{ marginTop: 14 }}>
        <CheckList title="Pre-checks" items={up.pre_checks} />
        <div><h3>Steps ({up.steps.length})</h3><ol className="steplist">{up.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>
        <CheckList title="Post-checks" items={up.post_checks} />
      </div>
      <p className="hint" style={{ marginTop: 12 }}><b>Rollback note (from the code):</b> {up.rollback_note}</p>
      {up.status === 'Failed' && <p className="hint warn-text">As written, run_upgrade() does not stop at a failed pre-check: it still records every step and reports Failed at the end, with rollback_triggered left false. A real procedure would halt before step 2.</p>}
    </section>
  );
}

/* ================================ Deep: cost ================================ */
function Cost() {
  const a = deepJson.cost_model.assumptions;
  const [nodes, setNodes] = useState(a.nodes);
  const [per, setPer] = useState(a.modelled_usd_per_node_per_month);
  const [st, setSt] = useState(a.modelled_storage_usd_per_month);
  const m = costModel(nodes, per, st);
  const isDefault = nodes === a.nodes && per === a.modelled_usd_per_node_per_month && st === a.modelled_storage_usd_per_month;
  const W = 360, H = 46, tot = Math.max(1, m.total_modelled_usd_per_month), w = (v) => (v / tot) * W;
  return (
    <section id="cost" className="card window reveal" data-title="cost_model.py — modelled cost calculator">
      <div className="head">
        <div>
          <p className="eyebrow">Deep · live calculator</p>
          <h2>Nodes × per-node price + storage. <em>Shape, not amounts.</em></h2>
        </div>
        <span className="pill warn">● Modelled, illustrative, not real prices</span>
      </div>
      <p className="sub">Label from the code: <q>{deepJson.cost_model.label}</q>. Defaults are the recorded assumptions in results_deep.json; the unit prices are invented.</p>
      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="controls" style={{ gridTemplateColumns: '1fr' }}>
          <Range label="Nodes" value={nodes} min={1} max={12} step={1} onChange={setNodes} />
          <Range label="Modelled USD per node per month" value={per} min={0} max={200} step={5} onChange={setPer} />
          <Range label="Modelled storage USD per month" value={st} min={0} max={100} step={5} onChange={setSt} />
        </div>
        <div>
          <div className="tile"><div className="num">{fmt(m.total_modelled_usd_per_month)} USD</div><div className="cap">modelled per month: {fmt(m.node_cost_usd_per_month)} nodes + {fmt(m.storage_cost_usd_per_month)} storage{isDefault ? ` (equals the recorded ${deepJson.cost_model.total_modelled_usd_per_month})` : ''}</div></div>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Modelled monthly cost split between nodes and storage" style={{ marginTop: 12 }}>
            <rect x={0} y={4} width={w(m.node_cost_usd_per_month)} height={24} rx={6} fill="var(--primary)" />
            <rect x={w(m.node_cost_usd_per_month)} y={4} width={w(m.storage_cost_usd_per_month)} height={24} rx={6} fill="var(--warn)" />
            <text x={0} y={44}>nodes {fmt(m.node_cost_usd_per_month)}</text><text x={W} y={44} textAnchor="end">storage {fmt(m.storage_cost_usd_per_month)}</text>
          </svg>
        </div>
      </div>
    </section>
  );
}

/* ================================ Recorded explorer ================================ */
const TABS = {
  learnPods: ['Learn pods_final', learnJson.pods_final, ['name', 'owner', 'status', 'node', 'cpu_m', 'mem_mib', 'max_batch', 'reason']],
  buildPods: ['Build pods_final', buildJson.pods_final, ['name', 'namespace', 'kind', 'owner', 'status', 'node', 'cpu_req_m', 'cpu_lim_m', 'mem_req_mib', 'mem_lim_mib', 'gpu', 'reason']],
  jobs: ['Build jobs', buildJson.jobs.map((j) => ({ ...j, pod_names: j.pod_names.join(', ') })), ['name', 'namespace', 'status', 'attempts', 'retries', 'ticks_total', 'pod_names', 'cpu_req_m', 'mem_req_mib', 'gpu']],
  actions: ['Deep action_log', deepJson.action_log, ['seq', 'pass', 'action', 'pod', 'from_version', 'to_version']],
  rejections: ['Build rejections', buildJson.rejections, ['pod', 'namespace', 'reason']],
};

function Explorer() {
  const [tab, setTab] = useState('learnPods');
  const [sort, setSort] = useState({ k: null, dir: 1 });
  const [label, rows0, cols] = TABS[tab];
  const rows = useMemo(() => {
    if (!sort.k) return rows0;
    return [...rows0].sort((a, b) => { const x = a[sort.k], y = b[sort.k]; if (x === y) return 0; if (x === null) return 1; if (y === null) return -1; return (x < y ? -1 : 1) * sort.dir; });
  }, [rows0, sort]);
  const nodeSets = [
    ['Learn node_usage_final, cpu (m)', LEARN_NODES.map(([n, cpu]) => ({ name: n, cap: cpu, used: learnJson.node_usage_final[n].cpu_m, pods: learnJson.node_usage_final[n].pods.map((p) => learnJson.pods_final.find((q) => q.name === p)) })), 'cpu_m'],
    ['Build node_usage_final, cpu requests (m)', BUILD_NODES.map(([n, cpu]) => ({ name: n, cap: cpu, used: buildJson.node_usage_final[n].cpu_m, pods: buildJson.node_usage_final[n].pods.map((p) => buildJson.pods_final.find((q) => q.name === p)) })), 'cpu_req_m'],
  ];
  return (
    <section id="explorer" className="card window reveal" data-title="results_*.json — recorded results explorer">
      <div className="head">
        <div>
          <p className="eyebrow">Recorded scenario output, from results_*.json</p>
          <h2>The committed runs, <em>as recorded</em>.</h2>
          <p className="sub">A replay of the files the Python runners wrote, imported at build time. Click a column header to sort.</p>
        </div>
      </div>
      <div className="seg wrap-seg" role="group" aria-label="Recorded table">
        {Object.entries(TABS).map(([k, [l]]) => <button key={k} aria-pressed={tab === k} onClick={() => { setTab(k); setSort({ k: null, dir: 1 }); }}>{l}</button>)}
      </div>
      <div className="scroll-x" style={{ marginTop: 12 }}>
        <table className="wide">
          <caption className="hint">{label}: {rows.length} rows</caption>
          <thead><tr>{cols.map((c) => <th key={c} aria-sort={sort.k === c ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}><button className="th-btn" onClick={() => setSort((s) => ({ k: c, dir: s.k === c ? -s.dir : 1 }))}>{c}{sort.k === c ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className={c === 'status' ? `st-${r[c]}` : ''}>{r[c] === null || r[c] === undefined ? '—' : String(r[c])}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="grid2" style={{ marginTop: 18 }}>
        {nodeSets.map(([t, nodes, res]) => <div key={t}><h3>{t}</h3><CapacityBars title={t} nodes={nodes} resource={res} unit="m" colorOf={ownerColor} /></div>)}
      </div>
    </section>
  );
}

/* ================================ Fuzzer ================================ */
function Fuzz() {
  const [runs, setRuns] = useState(200);
  const [steps, setSteps] = useState(25);
  const [seed, setSeed] = useState(20);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = useCallback(() => {
    setBusy(true);
    requestAnimationFrame(() => setTimeout(() => { const t = performance.now(); const r = fuzz({ runs, steps, seed }); setRes({ r, ms: performance.now() - t }); setBusy(false); }, 0));
  }, [runs, steps, seed]);
  useEffect(() => { run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const seedId = useId();
  return (
    <section id="fuzz" className="card window reveal" data-title="fuzz.js — randomized invariant check (new exploration)">
      <div className="head">
        <div>
          <p className="eyebrow">New exploration · in-browser property check of the repo&apos;s rules, not a repo result</p>
          <h2>Random pods and random drift, <em>thousands of times</em>.</h2>
          <p className="sub">The repo&apos;s tests check one designed scenario per level. This runs random operation sequences through the JavaScript ports and counts invariant checks. The same properties now also run in Python in <a href={blob('tests/test_invariants.py')}>tests/test_invariants.py</a>.</p>
        </div>
        {res && <span className="pill info">{fmt(res.r.reduce((s, i) => s + i.checks, 0))} checks in {res.ms.toFixed(0)} ms</span>}
      </div>
      <div className="controls">
        <Range label="Random runs" value={runs} min={20} max={1000} step={20} onChange={setRuns} />
        <Range label="Steps per run" value={steps} min={5} max={60} step={5} onChange={setSteps} />
        <div className="field"><label htmlFor={seedId}>Seed</label><input id={seedId} type="number" value={seed} onChange={(e) => setSeed(+e.target.value || 1)} /></div>
      </div>
      <div className="actions" style={{ marginTop: 0 }}><button className="btn primary" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Run invariant check'}</button></div>
      {res && (
        <div className="scroll-x" style={{ marginTop: 14 }}>
          <table>
            <thead><tr><th>Invariant</th><th>Checks</th><th>Violations</th></tr></thead>
            <tbody>{res.r.map((i) => <tr key={i.label}><td>{i.label}</td><td>{fmt(i.checks)}</td><td className={i.violations ? 'no' : 'ok'}>{i.violations}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ================================ Failure modes ================================ */
function Failures({ act }) {
  const { setLearnOps, setBuildSpec, setDeepOps, setHealthy, go } = act;
  const deepActions = {
    'declared version never converges': ['Declared v2, not yet reconciled', () => { setDeepOps(DEEP_SCRIPT.slice(0, 3)); go('operator'); }],
    'silent drift': ['Drift injected, no reconcile yet', () => { setDeepOps(DEEP_SCRIPT.slice(0, 7)); go('operator'); }],
    'non-idempotent reconcile': ['Pass 2 on a converged set', () => { setDeepOps(DEEP_SCRIPT.slice(0, 2)); go('operator'); }],
    'upgrade without pre-checks': ['Upgrade with an unhealthy endpoint', () => { setHealthy(false); go('upgrade'); }],
    'upgrade stuck mid-way': ['The ordered step log', () => { setHealthy(true); go('upgrade'); }],
    'rollback as a story, not a procedure': ['The rollback note', () => go('upgrade')],
    'cost blindness': ['The modelled calculator', () => go('cost')],
  };
  const learnActions = {
    Pod: ['A pod that fits nowhere', () => { setLearnOps([{ t: 'replay' }]); go('learn'); }],
    Deployment: ['api-1 deleted, not yet healed', () => { setLearnOps([{ t: 'base' }, { t: 'delete', name: 'api-1' }]); go('learn'); }],
    Service: ['Endpoints after heal and rollout', () => { setLearnOps([{ t: 'replay' }]); go('learn'); }],
    ConfigMap: ['Stale pods after the MAX_BATCH edit', () => { setLearnOps([{ t: 'replay' }]); go('learn'); }],
  };
  const probe = (name) => () => { setBuildSpec({ ...BUILD_PROBES.find((p) => p.name === name), stage: 'admission' }); go('build'); };
  const buildItems = [
    ...buildJson.rejections.map((r) => ({ title: `Quota rejection: ${r.pod}`, body: r.reason, show: ['Load this probe', probe(r.pod)] })),
    ...Object.entries(buildJson.probes).map(([k, p]) => { const name = k.replace(/_/g, '-'); return { title: `${p.status}: ${name}`, body: p.reason, show: ['Load this probe', probe(name)] }; }),
  ];
  const groups = [
    ['Deep: written failure modes', 'level-3-deep/README.md', DEEP_FAILURES.map((f) => ({ ...f, show: deepActions[f.title.toLowerCase()] }))],
    ['Learn: what breaks without each object', 'level-1-learn/README.md', LEARN_BREAKS.map((f) => ({ ...f, show: learnActions[f.title] }))],
    ['Build: recorded rejections and Pending reasons', 'level-2-build/results_build.json', buildItems],
  ];
  return (
    <section id="failures" className="card window reveal" data-title="failure_modes.md — linked to the playgrounds">
      <p className="eyebrow">Failure modes, as written in the repo</p>
      <h2>Each failure, and <em>the state that shows it</em>.</h2>
      <p className="sub">Text is read from the repo at build time. Each button loads the matching state into a playground above.</p>
      {groups.map(([title, src, items]) => (
        <div key={title} style={{ marginTop: 20 }}>
          <h3>{title} <a className="hint" href={blob(src)}>{src}</a></h3>
          <div className="grid2" style={{ marginTop: 10 }}>
            {items.map((f) => (
              <div className="tile fm" key={f.title}>
                <b>{f.title}</b>
                <p className="hint">{f.body}</p>
                {f.show && <button className="btn ghost sm" onClick={f.show[1]}>Show: {f.show[0]}</button>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/* ================================ Method and honesty ================================ */
function Method() {
  const docs = [
    ['level-1-learn/cluster.py', 'cluster.py', 'Learn simulator'],
    ['level-2-build/platform.py', 'platform.py', 'Build simulator'],
    ['level-3-deep/deep_operator.py', 'deep_operator.py', 'Deep operator'],
    ['ROADMAP.md', 'ROADMAP.md', 'v1.1 backlog, not built'],
    ['NOVELTY.md', 'NOVELTY.md', 'Draft, unverified'],
    ['docs/research-review.md', 'Research review', 'Rigor grade and gaps'],
  ];
  return (
    <section id="method" className="card window reveal" data-title="README.md — method and honesty">
      <p className="eyebrow">Method, limits and honesty</p>
      <h2>How you can tell this page is <em>the repo&apos;s rules</em>, and what it cannot tell you.</h2>
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="tile"><h3>The port is proven equal</h3><p className="hint"><code>npm run build</code> first runs <code>src/sim.check.mjs</code>: it replays run_learn.py, run_build.py and run_deep.py through the JavaScript ports and deep-compares every computed field with the three committed results files (only the descriptive note fields are skipped). One differing value fails the build, so a deployed page cannot drift from the Python.</p></div>
        <div className="tile"><h3>Deterministic by construction</h3><p className="hint">Iteration is over sorted names, ties break by node name, and no result carries a wall-clock field, so the Python runners write byte-identical files on every run and CI diffs them. The fuzzer is seeded, so a run repeats from its seed.</p></div>
        <div className="tile"><h3>Novelty: <span className="pill warn">DRAFT, unverified</span></h3><p className="hint">NOVELTY.md says: <q>{NOVELTY_STATUS}</q> Its prior-art table has no measurement yet. Related work is reviewed in docs/research-review.md.</p></div>
        <div className="tile"><h3>Grades: <span className="pill warn">self-assessed</span></h3><p className="hint">docs/index.md records: <q>{GRADES_LINE}</q> These are the author&apos;s own grades, with no external rubric behind them. They are not external validation.</p></div>
      </div>
      <h3 style={{ marginTop: 20 }}>Limits and threats to validity</h3>
      <ul className="limits">
        <li><b>External validity:</b> every level is a simulation. No kind or k3d cluster, no real CRD or controller-runtime operator, no kubelet, no GPU device plugin. The spec&apos;s Learn scope asked for a local cluster; this falls short of it.</li>
        <li><b>No measurement:</b> no latency, throughput, reconcile timing or resource figures. Every number is a designed-scenario output.</li>
        <li><b>Simple models:</b> the scheduler scores on cpu only (memory and GPU are fit checks), taints model NoSchedule only, jobs run one at a time with declared failures, and the operator replaces pods in name order without an availability guard.</li>
        {NOT_DONE.map(([l, t]) => <li key={l}><b>{l} README, what this level does not do:</b> {t}</li>)}
      </ul>
      <h3 style={{ marginTop: 20 }}>v1.1 backlog from ROADMAP.md (named, not built)</h3>
      <ol className="steps" style={{ marginTop: 10 }}>
        {ROADMAP_ITEMS.map((t, i) => <li key={i}><span className="n">{i + 1}</span><div className="hint">{t}</div></li>)}
      </ol>
      <h3 style={{ marginTop: 20 }}>Reproduce</h3>
      <ol className="steps terminal" style={{ marginTop: 10 }}>
        <li><span className="n">1</span><div><b>Run the Python tests and runners</b><div className="hint"><code>python3 tests/test_learn_platform.py && python3 tests/test_build_platform.py && python3 tests/test_deep_platform.py</code></div></div></li>
        <li><span className="n">2</span><div><b>Regenerate the results and diff</b><div className="hint"><code>python3 level-3-deep/run_deep.py && git diff --exit-code level-*/results_*.json</code></div></div></li>
        <li><span className="n">3</span><div><b>Build this page with its known-answer gate</b><div className="hint"><code>cd site && npm ci && npm run build</code></div></div></li>
      </ol>
      <div className="docs" style={{ marginTop: 20 }}>
        {docs.map(([p, t, d]) => <a key={p} href={blob(p)}><b>{t}</b><small>{d}</small></a>)}
      </div>
      <p className="hint" style={{ marginTop: 14 }}>Releases: <a href={`${REPO}/releases`}>{REPO.replace('https://', '')}/releases</a></p>
    </section>
  );
}
