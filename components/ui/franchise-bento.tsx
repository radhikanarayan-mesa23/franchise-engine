// @ts-nocheck
"use client";
/* Franchise network bento. Adapted from the "Finance Bento" component (vasnev.art):
   tick gauge, operations tiles, capsule slots and territory waves; decisions only, no financials
   columns, but every figure comes from the decision engine — nothing is invented here.
   Charts are drawn with plain DOM + SVG inside an effect, so this file is checked as JS. */

import * as React from "react";
import { useTheme } from "next-themes";

export interface FranchiseBentoData {
  mix: { label: string; value: number; color: string }[];
  ops: { processed: number; needsHuman: number; onHold: number; dataIssues: number; approved: number; decisionSec: number | null };
  slots: { filled: number; total: number; approved: number };
  deadlines: { name: string; date: string; what: string }[];
  territories: { id: string; city: string; filled: number; capacity: number }[];
}

const CSS = `.frb{--acc:#1B7FDC;--acc2:#0DB8D3;--t1:var(--ink);--t2:rgba(var(--fg-rgb),.88);--t3:rgba(var(--fg-rgb),.78);--hair:rgba(var(--fg-rgb),.12);--ease:cubic-bezier(.32,.72,0,1);
  --c1:#0DB8D3;--c2:#C4B5FD;--c3:#7DD3FC;font-family:inherit;color:var(--ink);width:100%}
.frb *{box-sizing:border-box}
.frb .top{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.frb .top h2{margin:0;font-size:18px;font-weight:700;letter-spacing:-.03em;flex:1}
.frb .top h2 span{font-weight:500;color:var(--t3);font-size:13px;margin-left:10px}
.frb .grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
.frb .h1{height:270px}.frb .h2{height:132px}
.frb #alloc{grid-column:span 4}.frb #ops{grid-column:span 8}.frb .kpi{grid-column:span 4}
.frb #flow{grid-column:span 5}.frb #terr{grid-column:span 4}.frb #stat{grid-column:span 3}
@media (max-width:1199px){.frb #alloc{grid-column:span 12}.frb #ops{grid-column:span 12}.frb .kpi{grid-column:span 6}.frb #flow{grid-column:span 12}.frb #terr,.frb #stat{grid-column:span 6}}
@media (max-width:767px){.frb #ops{height:auto}.frb #alloc{grid-column:span 12;height:300px}.frb .kpi{grid-column:span 6}.frb #terr,.frb #stat{grid-column:span 12}.frb .grid{gap:12px}.frb .top{flex-wrap:wrap}}
@media (max-width:520px){.frb .kpi{grid-column:span 12}}
.frb .card{position:relative;border-radius:18px;overflow:hidden;opacity:0;transform:translateY(14px) scale(.985);transition:opacity .7s ease,transform .9s var(--ease);margin:0;padding:0;animation:none}
.frb .in .card{opacity:1;transform:none}
.frb .rim{position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 1px 0 rgba(var(--fg-rgb),.1);pointer-events:none;z-index:9}
.frb .g{position:absolute;inset:0}.frb .core{position:absolute;left:10%;right:10%;top:16%;bottom:-6%;border-radius:90px;filter:blur(60px)}
.frb .glass{background:linear-gradient(160deg,rgba(var(--fg-rgb),.1),rgba(var(--fg-rgb),.05));border:1px solid rgba(var(--fg-rgb),.14);backdrop-filter:blur(20px);box-shadow:0 12px 34px rgba(4,20,32,.35)}
.frb .in-c{position:absolute;inset:0;padding:16px 18px;z-index:2}
.frb .ttl{font-size:15px;font-weight:600;letter-spacing:-.02em}
.frb .cap{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--t2)}
.frb .big{font-size:30px;font-weight:700;letter-spacing:-.035em;line-height:1;font-variant-numeric:tabular-nums}
.frb .muted{font-size:12.5px;color:var(--t3);font-weight:500}
.frb .row{display:flex;align-items:center;gap:12px}.frb .mono{font-variant-numeric:tabular-nums}
.frb .tip{position:fixed;z-index:50;pointer-events:none;background:var(--bg-2);color:var(--ink);border:1px solid rgba(var(--fg-rgb),.12);border-radius:14px;padding:9px 11px;font-size:12px;backdrop-filter:blur(16px);opacity:0;transform:translateY(4px);transition:opacity .15s,transform .15s;white-space:nowrap;min-width:160px}
.frb .tip.on{opacity:1;transform:none}.frb .tip .t{color:var(--t2);margin-bottom:5px}.frb .tip .r{display:flex;justify-content:space-between;gap:14px;align-items:center;line-height:19px}
.frb .tip .r span{display:inline-flex;align-items:center;gap:6px;color:var(--t2)}.frb .tip i{width:7px;height:7px;border-radius:50%}
@media (prefers-reduced-motion: reduce){.frb .card{transition:none}}
.frb .mono{font-family:var(--font-geist-mono),ui-monospace,monospace}`;

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function mount(root, data, opts) {
  let alive = true;
  const frames = new Set();
  const RAF = (cb) => { if (!alive) return 0; const id = requestAnimationFrame((t) => { frames.delete(id); if (alive) cb(t); }); frames.add(id); return id; };
  const $ = (id) => root.querySelector("#" + id);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tok = (n) => getComputedStyle(root).getPropertyValue(n).trim();
  const FG = tok("--fg-rgb") || "255,255,255", fgA = (a) => `rgba(${FG},${a})`;
  const ACC = tok("--accent-2"), INK = tok("--ink"), PANEL = tok("--bg-2"), T2 = fgA(.88), T3 = fgA(.72), HAIR = fgA(.14);
  const COL = { t1: tok("--accent"), t2: tok("--accent-2"), t3: tok("--deep") };
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const NS = "http://www.w3.org/2000/svg";
  const el = (t, a = {}, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); p && p.appendChild(e); return e; };
  const lakh = (v, dec = 1) => "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: dec, minimumFractionDigits: 0 }) + "L";


  root.innerHTML = `<div class="top"><h2>${esc(opts.title)}<span>${esc(opts.subtitle)}</span></h2></div>
    <div class="grid" id="grid">
      <section class="card glass h1" id="alloc" aria-label="Decision mix"></section>
      <section class="card glass h1" id="ops" aria-label="Operations"></section>
      <section class="card glass h2 kpi" id="cash" aria-label="Slots filled"></section>
      <section class="card glass h2 kpi" id="pay" aria-label="Upcoming deadlines"></section>
      <section class="card glass h2 kpi" id="goals" aria-label="Territory fill"></section>
    </div><div class="tip" id="tip"></div>`;

  const bg = () => "";
  const GR = {
    plum: { top: "#7c5cff", base: "#2a1a5e", bottom: "#4b2fa3", core: "#ffffff" },
    graph: { top: "#5a5468", base: "#24202e", bottom: "#36303f", core: "#08070b" },
    saffron: { top: "#b9eef6", base: "#1B7FDC", bottom: "#ffc861", core: "#3a2203" },
    rose: { top: "#ff9fb7", base: "#b3264f", bottom: "#d94a73", core: "#2a0512" },
    teal: { top: "#8fe3e0", base: "#1f6f78", bottom: "#3b98a0", core: "#04181a" },
    violet: { top: "#cbb8ff", base: "#5b3fd6", bottom: "#7d63ea", core: "#0d0624" },
  };
  function smooth(P, move = true) { let d = (move ? "M" : "L") + `${P[0][0]},${P[0][1]}`; for (let i = 0; i < P.length - 1; i++) { const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2, k = .17;
    d += `C${p1[0] + (p2[0] - p0[0]) * k},${p1[1] + (p2[1] - p0[1]) * k} ${p2[0] - (p3[0] - p1[0]) * k},${p2[1] - (p3[1] - p1[1]) * k} ${p2[0]},${p2[1]}`; } return d; }
  const P2 = (r, a) => [r * Math.cos(a * Math.PI / 180), r * Math.sin(a * Math.PI / 180)];
  function tween(node, to, fmt, dur = 900) { const from = +node.dataset.v || 0, t0 = performance.now(); node.dataset.v = to;
    (function f(now) { const t = reduce ? 1 : Math.min(1, (now - t0) / dur); node.textContent = fmt(from + (to - from) * ease(t)); if (t < 1) RAF(f); })(t0); }
  const tip = $("tip");
  function showTip(x, y, title, rows) { tip.innerHTML = `<div class="t">${esc(title)}</div>` + rows.map(([k, v, c]) => `<div class="r"><span>${c ? `<i style="background:${c}"></i>` : ""}${esc(k)}</span><b>${esc(v)}</b></div>`).join("");
    tip.classList.add("on"); const r = tip.getBoundingClientRect(); let L = x + 16, T = y - r.height - 14; if (L + r.width > innerWidth - 8) L = x - r.width - 16; if (T < 8) T = y + 16; tip.style.left = L + "px"; tip.style.top = T + "px"; }
  const hideTip = () => tip.classList.remove("on");
  const total = (p) => p.t1 + p.t2 + p.t3;

  /* ---- Decision mix: half gauge of ticks ---- */
  const al = $("alloc");
  al.innerHTML = `${bg(GR.graph)}<div class="in-c"><div class="row" style="justify-content:space-between"><div class="ttl">Decision mix</div><span class="muted">${data.mix.reduce((a, m) => a + m.value, 0)} applications</span></div>
    <svg class="alg" width="210" height="118" viewBox="-150 -150 300 168" style="position:absolute;left:50%;margin-left:-105px;top:44px" aria-hidden="true"></svg>
    <div class="all" style="position:absolute;left:18px;right:18px;bottom:12px"></div></div><div class="rim"></div>`;
  function updateMix() {
    const tot = data.mix.reduce((a, m) => a + m.value, 0) || 1, n = 56, svg = al.querySelector(".alg"); let s = "", acc = 0;
    const bounds = data.mix.map((m) => (acc += m.value / tot));
    for (let i = 0; i <= n; i++) { const f = i / n, a = 180 + f * 180, k = Math.max(0, bounds.findIndex((b) => f <= b + 1e-9)); const [x1, y1] = P2(136, a), [x2, y2] = P2(i % 7 === 0 ? 112 : 118, a);
      s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" style="stroke:${data.mix[k]?.color ?? "var(--st-none)"}" stroke-width="3.2" stroke-linecap="round" style="opacity:0;animation:tk .4s ${i * 12}ms forwards"/>`; }
    const share = Math.round(((data.mix[0]?.value ?? 0) + (data.mix[1]?.value ?? 0)) / tot * 100);
    s += `<text y="-22" text-anchor="middle" font-weight="700" font-size="46" fill="${INK}" letter-spacing="-2">${share}<tspan font-size="17" dy="-24" fill="${T2}">%</tspan></text><text y="0" text-anchor="middle" font-size="12" fill="${T3}">approved or conditional</text><text x="-128" y="14" text-anchor="middle" font-size="10" fill="${T3}" class="mono">0%</text><text x="128" y="14" text-anchor="middle" font-size="10" fill="${T3}" class="mono">100%</text>`;
    svg.innerHTML = `<style>@keyframes tk{to{opacity:1}}</style>` + s;
    al.querySelector(".all").innerHTML = data.mix.filter((m) => m.value).map((m, i) => `<div class="row" style="height:23px;${i ? "border-top:1px solid ${fgA(.07)}" : ""}"><i style="width:8px;height:8px;border-radius:50%;background:${m.color}"></i><span style="flex:1;font-size:12.5px;font-weight:600">${esc(m.label)}</span><span class="mono muted" style="width:40px;text-align:right">${Math.round(m.value / tot * 100)}%</span><span class="mono" style="width:30px;text-align:right;font-size:13px">${m.value}</span></div>`).join("");
  }

  /* ---- Operations: honest counts the engine already computed ---- */
  const ops = $("ops");
  const OPS = [["Applications processed", data.ops.processed, ""], ["Approved or conditional", data.ops.approved, ""], ["Need a human", data.ops.needsHuman, "var(--st-review)"],
    ["On hold", data.ops.onHold, "var(--st-hold)"], ["Data issues", data.ops.dataIssues, "var(--st-cond)"], ["Time to decision", data.ops.decisionSec, ""]];
  ops.innerHTML = `<div class="in-c"><div class="row" style="justify-content:space-between"><div class="ttl">This run</div><span class="muted">engine output, no estimates</span></div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:14px">${OPS.map(([k, v, c], i) => `<div style="border:1px solid ${HAIR};border-radius:14px;padding:14px 16px;background:${fgA(.04)}">
      <div class="cap" style="${c ? `color:${c}` : ""}">${esc(k)}</div><div class="big mono opv" data-i="${i}" style="margin-top:8px">${v === null ? "–" : "0"}</div></div>`).join("")}</div></div>`;
  const updateOps = () => ops.querySelectorAll(".opv").forEach((n) => { const [, v] = OPS[+n.dataset.i]; if (v === null) return; tween(n, v, (x) => +n.dataset.i === 5 ? `${x.toFixed(1)} s` : Math.round(x).toString()); });

  /* ---- KPI: slots filled with tick ruler ---- */
  const cash = $("cash");
  cash.innerHTML = `<div class="in-c"><div class="row" style="justify-content:space-between"><div class="cap">Real slots filled</div><span class="muted">capacity</span></div>
    <div class="row" style="margin-top:10px;align-items:baseline;justify-content:space-between"><span class="big csv">0</span><span class="mono" style="font-size:18px;font-weight:500">/ ${data.slots.total}</span></div>
    <svg class="cst" height="22" style="position:absolute;left:22px;bottom:20px;width:calc(100% - 44px)" aria-hidden="true"></svg></div>`;
  function updateCash() { tween(cash.querySelector(".csv"), data.slots.filled, (x) => Math.round(x).toString());
    const svg = cash.querySelector(".cst"), W = svg.getBoundingClientRect().width || 220, n = 36, f = data.slots.total ? data.slots.filled / data.slots.total : 0; let s = "";
    for (let i = 0; i < n; i++) { const x = 1 + i * (W - 2) / (n - 1), on = i / (n - 1) <= f && f > 0; s += `<line x1="${x}" x2="${x}" y1="${i % 6 === 0 ? 2 : 8}" y2="20" stroke="${on ? ACC : fgA(.25)}" stroke-width="1.6" stroke-linecap="round" style="transition:stroke .2s ${i * 14}ms"/>`; }
    svg.innerHTML = s; }

  /* ---- KPI: upcoming deadlines ---- */
  const pay = $("pay");
  pay.innerHTML = `<div class="in-c" style="padding-bottom:12px"><div class="row" style="justify-content:space-between"><div class="cap">Next deadlines</div><span class="muted">${data.deadlines.length} open</span></div>
    <div style="margin-top:8px">${data.deadlines.slice(0, 3).map((d, i) => `<div class="row" style="height:28px;${i ? "border-top:1px solid ${fgA(.07)}" : ""}" title="${esc(d.what)}"><i style="width:24px;height:24px;border-radius:8px;background:rgba(13,184,211,.18);color:${ACC};display:grid;place-items:center;font-weight:700;font-size:11px;font-style:normal">${esc(d.name.charAt(0))}</i><span style="flex:1;font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.name)}</span><span class="muted mono" style="font-size:11.5px">${esc(d.date)}</span></div>`).join("") || `<p class="muted">No open deadlines.</p>`}</div></div>`;

  /* ---- KPI: territory fill ---- */
  const goals = $("goals");
  goals.innerHTML = `<div class="in-c"><div class="row" style="justify-content:space-between"><div class="cap">Territory fill</div><span class="muted">${data.territories.length} territories</span></div>
    ${data.territories.slice(0, 2).map((t, k) => `<div style="margin-top:${k ? 14 : 16}px"><div class="row" style="justify-content:space-between;font-size:12.5px;font-weight:600"><span>${esc(t.id)} · ${esc(t.city)}</span><span class="mono" style="font-weight:500">${t.filled}<span class="muted"> of ${t.capacity}</span></span></div>
      <svg width="100%" height="12" style="margin-top:8px;display:block" class="gl" data-f="${t.capacity ? t.filled / t.capacity : 0}" aria-hidden="true"></svg></div>`).join("")}</div>`;
  function updateGoals() { RAF(() => goals.querySelectorAll(".gl").forEach((svg, k) => { const W = svg.getBoundingClientRect().width, n = 40, f = +svg.dataset.f; let s = "";
    for (let i = 0; i < n; i++) { const x = 1 + i * (W - 2) / (n - 1), on = f > 0 && i / (n - 1) <= f; s += `<line x1="${x}" x2="${x}" y1="${i % 8 === 0 ? 0 : 4}" y2="12" stroke="${on ? ACC : fgA(.25)}" stroke-width="1.6" stroke-linecap="round" style="opacity:0;animation:tk2 .3s ${300 + k * 150 + i * 12}ms forwards"/>`; }
    svg.innerHTML = "<style>@keyframes tk2{to{opacity:1}}</style>" + s; })); }

  /* ---- controls + lifecycle ---- */
  function updateAll() { updateMix(); updateOps(); updateCash(); updateGoals(); }
  let rz; const ro = new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => { updateCash(); updateGoals(); }, 120); });
  ["cash"].forEach((id) => ro.observe($(id)));
  RAF(() => { $("grid").classList.add("in"); root.querySelectorAll(".card").forEach((c, i) => (c.style.transitionDelay = (i * 60) + "ms")); updateAll(); });
  return () => { alive = false; frames.forEach((f) => cancelAnimationFrame(f)); ro.disconnect(); clearTimeout(rz); };
}

export function FranchiseBento({ data, title = "Network overview", subtitle = "", className = "", style }: { data: FranchiseBentoData; title?: string; subtitle?: string; className?: string; style?: React.CSSProperties }) {
  const ref = React.useRef(null);
  const { resolvedTheme } = useTheme();
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const stop = mount(node, data, { title, subtitle });
    return () => { stop(); node.innerHTML = ""; };
  }, [data, title, subtitle, resolvedTheme]);
  return (<><style>{CSS}</style><div ref={ref} className={`frb ${className}`} style={style} /></>);
}

export default FranchiseBento;
