// @ts-nocheck
"use client";
/* Franchise network bento. Adapted from the "Finance Bento" component (vasnev.art):
   same layout, dot-matrix counter, stream chart, tick gauge, mirrored waves and capsule
   columns, but every figure comes from the decision engine — nothing is invented here.
   Charts are drawn with plain DOM + SVG inside an effect, so this file is checked as JS. */

import * as React from "react";

export interface FranchiseBentoData {
  /** Projected monthly sales of approved partners, ₹ lakh, split by city tier. */
  stream: { label: string; t1: number; t2: number; t3: number }[];
  /** Brand royalty per month, ₹ lakh (same months as stream). */
  royalty: number[];
  mix: { label: string; value: number; color: string }[];
  brand: { totalLakh: number; feeLakh: number; royaltyLakh: number; royaltyPct: number; months: number };
  slots: { filled: number; total: number; approved: number };
  deadlines: { name: string; date: string; what: string }[];
  territories: { id: string; city: string; filled: number; capacity: number; salesLakh: number; spark: number[] }[];
  statuses: { label: string; count: number; highlight?: boolean }[];
}

const CSS = `.frb{--acc:#F5A524;--acc2:#FFCF70;--t1:#fff;--t2:rgba(255,255,255,.6);--t3:rgba(255,255,255,.4);--hair:rgba(255,255,255,.12);--ease:cubic-bezier(.32,.72,0,1);
  --c1:#FFCF70;--c2:#C4B5FD;--c3:#7DD3FC;font-family:inherit;color:#fff;width:100%}
.frb *{box-sizing:border-box}
.frb .top{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.frb .top h2{margin:0;font-size:22px;font-weight:700;letter-spacing:-.03em;flex:1}
.frb .top h2 span{font-weight:500;color:var(--t3);font-size:13px;margin-left:10px}
.frb .seg{display:flex;padding:3px;gap:2px;border-radius:14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}
.frb .seg button{border:0;height:28px;min-width:48px;padding:0 12px;border-radius:11px;background:transparent;color:var(--t2);font:600 12.5px inherit;cursor:pointer;transition:background .25s,color .25s;box-shadow:none}
.frb .seg button[aria-pressed="true"]{background:linear-gradient(135deg,var(--acc2),var(--acc));color:#1a1205}
.frb .grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px}
.frb .h1{height:360px}.frb .h2{height:168px}.frb .h3{height:320px}
.frb #nw{grid-column:span 8}.frb #alloc{grid-column:span 4}.frb .kpi{grid-column:span 3}
.frb #flow{grid-column:span 5}.frb #terr{grid-column:span 4}.frb #stat{grid-column:span 3}
@media (max-width:1199px){.frb #nw{grid-column:span 12}.frb #alloc{grid-column:span 6;grid-row:span 2;height:auto}.frb .kpi{grid-column:span 6}.frb #flow{grid-column:span 12}.frb #terr,.frb #stat{grid-column:span 6}}
@media (max-width:767px){.frb #nw{height:400px}.frb #alloc{grid-column:span 12;grid-row:auto;height:360px}.frb .kpi{grid-column:span 6}.frb #terr,.frb #stat{grid-column:span 12}.frb .grid{gap:12px}.frb .top{flex-wrap:wrap}}
@media (max-width:520px){.frb .kpi{grid-column:span 12}}
.frb .card{position:relative;border-radius:24px;overflow:hidden;opacity:0;transform:translateY(14px) scale(.985);transition:opacity .7s ease,transform .9s var(--ease);margin:0;padding:0;animation:none}
.frb .in .card{opacity:1;transform:none}
.frb .rim{position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,.2),inset 0 0 0 1px rgba(255,255,255,.06);pointer-events:none;z-index:9}
.frb .g{position:absolute;inset:0}.frb .core{position:absolute;left:10%;right:10%;top:16%;bottom:-6%;border-radius:90px;filter:blur(60px)}
.frb .glass{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(20px)}
.frb .in-c{position:absolute;inset:0;padding:20px 22px;z-index:2}
.frb .ttl{font-size:17px;font-weight:600;letter-spacing:-.02em}
.frb .cap{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--t2)}
.frb .big{font-size:38px;font-weight:200;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums}
.frb .delta{font-weight:600;font-size:12.5px;color:var(--acc2)}
.frb .muted{font-size:12.5px;color:var(--t3);font-weight:500}
.frb .chip{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:11px;background:rgba(0,0,0,.6);color:#fff;font-weight:600;font-size:11px}
.frb .legend{display:flex;gap:14px;font-size:12px;font-weight:500;color:var(--t2)}.frb .legend span{display:inline-flex;align-items:center;gap:6px}.frb .legend i{width:8px;height:8px;border-radius:50%}
.frb .row{display:flex;align-items:center;gap:12px}.frb .mono{font-variant-numeric:tabular-nums}
.frb .dots circle{transition:opacity .26s,transform .26s;transform-box:fill-box;transform-origin:center}
.frb .tip{position:fixed;z-index:50;pointer-events:none;background:rgba(14,12,20,.94);color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:9px 11px;font-size:12px;backdrop-filter:blur(16px);opacity:0;transform:translateY(4px);transition:opacity .15s,transform .15s;white-space:nowrap;min-width:160px}
.frb .tip.on{opacity:1;transform:none}.frb .tip .t{color:var(--t2);margin-bottom:5px}.frb .tip .r{display:flex;justify-content:space-between;gap:14px;align-items:center;line-height:19px}
.frb .tip .r span{display:inline-flex;align-items:center;gap:6px;color:var(--t2)}.frb .tip i{width:7px;height:7px;border-radius:50%}
@media (prefers-reduced-motion: reduce){.frb .card{transition:none}}`;

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function mount(root, data, opts) {
  let alive = true;
  const frames = new Set();
  const RAF = (cb) => { if (!alive) return 0; const id = requestAnimationFrame((t) => { frames.delete(id); if (alive) cb(t); }); frames.add(id); return id; };
  const $ = (id) => root.querySelector("#" + id);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ACC = "#F5A524", T2 = "rgba(255,255,255,.6)", T3 = "rgba(255,255,255,.4)", HAIR = "rgba(255,255,255,.12)";
  const COL = { t1: "#FFCF70", t2: "#C4B5FD", t3: "#7DD3FC" };
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const NS = "http://www.w3.org/2000/svg";
  const el = (t, a = {}, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); p && p.appendChild(e); return e; };
  const lakh = (v, dec = 1) => "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: dec, minimumFractionDigits: 0 }) + "L";

  const months = data.stream.length;
  const PERIODS = [12, 24, 36].filter((m) => m <= months);
  if (!PERIODS.includes(months)) PERIODS.push(months);
  const S = { period: Math.min(...PERIODS.filter((p) => p >= Math.min(12, months))) };

  root.innerHTML = `<div class="top"><h2>${esc(opts.title)}<span>${esc(opts.subtitle)}</span></h2>
      <div class="seg" id="period" role="group" aria-label="Projection period"></div></div>
    <div class="grid" id="grid">
      <section class="card h1" id="nw" aria-label="Projected network sales"></section>
      <section class="card h1" id="alloc" aria-label="Decision mix"></section>
      <section class="card h2 kpi" id="ret" aria-label="Brand revenue"></section>
      <section class="card glass h2 kpi" id="cash" aria-label="Slots filled"></section>
      <section class="card glass h2 kpi" id="pay" aria-label="Upcoming deadlines"></section>
      <section class="card glass h2 kpi" id="goals" aria-label="Territory fill"></section>
      <section class="card h3" id="flow" aria-label="Sales and royalty"></section>
      <section class="card h3" id="terr" aria-label="Territories"></section>
      <section class="card h3" id="stat" aria-label="Applications by status"></section>
    </div><div class="tip" id="tip"></div>`;

  const bg = ({ top, base, bottom, core }) => `<div class="g" style="background:linear-gradient(180deg,${top} 0%,${base} 36%,${base} 74%,${bottom} 100%)"></div><div class="core" style="background:${core}"></div>`;
  const GR = {
    plum: { top: "#7c5cff", base: "#2a1a5e", bottom: "#4b2fa3", core: "#0b0618" },
    graph: { top: "#5a5468", base: "#24202e", bottom: "#36303f", core: "#08070b" },
    saffron: { top: "#ffe0a3", base: "#f5a524", bottom: "#ffc861", core: "#3a2203" },
    rose: { top: "#ff9fb7", base: "#b3264f", bottom: "#d94a73", core: "#2a0512" },
    teal: { top: "#8fe3e0", base: "#1f6f78", bottom: "#3b98a0", core: "#04181a" },
    violet: { top: "#cbb8ff", base: "#5b3fd6", bottom: "#7d63ea", core: "#0d0624" },
  };
  function smooth(P, move = true) { let d = (move ? "M" : "L") + `${P[0][0]},${P[0][1]}`; for (let i = 0; i < P.length - 1; i++) { const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2, k = .17;
    d += `C${p1[0] + (p2[0] - p0[0]) * k},${p1[1] + (p2[1] - p0[1]) * k} ${p2[0] - (p3[0] - p1[0]) * k},${p2[1] - (p3[1] - p1[1]) * k} ${p2[0]},${p2[1]}`; } return d; }
  const P2 = (r, a) => [r * Math.cos(a * Math.PI / 180), r * Math.sin(a * Math.PI / 180)];
  const F = { "0": ["01110","10001","10011","10101","11001","10001","01110"], "1": ["00100","01100","00100","00100","00100","00100","01110"], "2": ["01110","10001","00001","00010","00100","01000","11111"], "3": ["11111","00010","00100","00010","00001","10001","01110"], "4": ["00010","00110","01010","10010","11111","00010","00010"], "5": ["11111","10000","11110","00001","00001","10001","01110"], "6": ["00110","01000","10000","11110","10001","10001","01110"], "7": ["11111","00001","00010","00100","01000","01000","01000"], "8": ["01110","10001","10001","01110","10001","10001","01110"], "9": ["01110","10001","10001","01111","00001","00010","01100"], "₹": ["11111","00100","11111","00100","01000","00110","00001"], "L": ["10000","10000","10000","10000","10000","10000","11111"], ",": ["0","0","0","0","0","1","1"], ".": ["0","0","0","0","0","0","1"], " ": ["00","00","00","00","00","00","00"] };
  function DotNumber(host, pitch) {
    const cols = 48, svg = el("svg", { class: "dots", "aria-hidden": "true" }, host), cells = [];
    for (let c = 0; c < cols; c++) for (let r = 0; r < 7; r++) { const ci = el("circle", { cx: c * pitch + pitch / 2, cy: r * pitch + pitch / 2, r: pitch * .36, fill: "#fff", opacity: 0 }, svg); ci.style.transitionDelay = (c * 7) + "ms"; cells.push([c, r, ci]); }
    const set = (t) => { const on = new Set(); let x = 0; for (const ch of t) { const g = F[ch] || F[" "]; const w = g[0].length; for (let r = 0; r < 7; r++) for (let k = 0; k < w; k++) if (g[r][k] === "1") on.add((x + k) * 8 + r); x += w + 1; }
      const used = Math.max(1, x - 1); for (const [c, r, ci] of cells) { const v = on.has(c * 8 + r); ci.setAttribute("opacity", v ? 1 : (c < used ? .08 : 0)); ci.style.transform = v ? "none" : "scale(.55)"; }
      svg.setAttribute("width", used * pitch); svg.setAttribute("height", 7 * pitch); svg.setAttribute("viewBox", `0 0 ${used * pitch} ${7 * pitch}`); };
    let raf = 0, cur = 0;
    return { count(to, dur = 900) { cancelAnimationFrame(raf); const from = cur, t0 = performance.now(); let last = "";
      const f = (now) => { const t = reduce ? 1 : Math.min(1, (now - t0) / dur); cur = from + (to - from) * ease(t); const s = "₹" + Math.round(cur).toLocaleString("en-IN") + "L"; if (s !== last) { set(s); last = s; } if (t < 1) raf = RAF(f); }; raf = RAF(f); } };
  }
  function tween(node, to, fmt, dur = 900) { const from = +node.dataset.v || 0, t0 = performance.now(); node.dataset.v = to;
    (function f(now) { const t = reduce ? 1 : Math.min(1, (now - t0) / dur); node.textContent = fmt(from + (to - from) * ease(t)); if (t < 1) RAF(f); })(t0); }
  const tip = $("tip");
  function showTip(x, y, title, rows) { tip.innerHTML = `<div class="t">${esc(title)}</div>` + rows.map(([k, v, c]) => `<div class="r"><span>${c ? `<i style="background:${c}"></i>` : ""}${esc(k)}</span><b>${esc(v)}</b></div>`).join("");
    tip.classList.add("on"); const r = tip.getBoundingClientRect(); let L = x + 16, T = y - r.height - 14; if (L + r.width > innerWidth - 8) L = x - r.width - 16; if (T < 8) T = y + 16; tip.style.left = L + "px"; tip.style.top = T + "px"; }
  const hideTip = () => tip.classList.remove("on");
  const total = (p) => p.t1 + p.t2 + p.t3;
  const series = () => data.stream.slice(0, S.period);

  /* ---- Projected network sales: stream by city tier ---- */
  const nw = $("nw");
  nw.innerHTML = `${bg(GR.plum)}<div class="in-c">
    <div class="row" style="justify-content:space-between;flex-wrap:wrap"><div class="ttl">Projected network sales</div>
      <div class="legend"><span><i style="background:${COL.t1}"></i>Tier 1</span><span><i style="background:${COL.t2}"></i>Tier 2</span><span><i style="background:${COL.t3}"></i>Tier 3</span></div></div>
    <div class="row" style="margin-top:14px;align-items:flex-end;gap:16px;flex-wrap:wrap"><div class="nwn"></div>
      <div style="padding-bottom:6px"><div class="delta nwd"></div><div class="muted nwc" style="margin-top:3px"></div></div></div>
    <svg class="nws" style="position:absolute;left:0;right:0;bottom:0;display:block" aria-hidden="true"></svg></div><div class="rim"></div>`;
  const nwNum = DotNumber(nw.querySelector(".nwn"), innerWidth < 520 ? 5 : 6.5);
  let grow = 0, nwRaf = 0;
  function drawNW() {
    const D = series(), svg = nw.querySelector(".nws"), W = nw.clientWidth, Hh = 210, top = 26, bot = 26, mid = top + (Hh - top - bot) / 2, n = D.length;
    svg.setAttribute("width", W); svg.setAttribute("height", Hh); svg.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
    if (n < 2) { svg.innerHTML = ""; return; }
    const tots = D.map(total), mx = Math.max(...tots, .01), half = (Hh - top - bot) / 2, X = (i) => -20 + i / (n - 1) * (W + 40), g = ease(grow);
    const lay = D.map((p) => { const q = (half * 2 / mx) * g / 2; return { a: p.t1 * q, ab: (p.t1 + p.t2) * q, abc: total(p) * q }; });
    const band = (k) => smooth(D.map((p, i) => [X(i), mid - lay[i][k]])) + smooth(D.map((p, i) => [X(i), mid + lay[i][k]]).reverse(), false) + "Z";
    const marks = [Math.round((n - 1) * .2), Math.round((n - 1) * .6), n - 1];
    svg.innerHTML = `<defs><linearGradient id="frf" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".2" stop-color="#fff" stop-opacity="1"/></linearGradient><mask id="frm"><rect width="${W}" height="${Hh}" fill="url(#frf)"/></mask></defs>
      <g mask="url(#frm)"><path d="${band("abc")}" fill="${COL.t3}" opacity=".9"/><path d="${band("ab")}" fill="${COL.t2}"/><path d="${band("a")}" fill="${COL.t1}"/></g>
      ${marks.map((i, k) => { const x = Math.min(W - 40, Math.max(40, X(i))); return `<g style="opacity:${g > .6 ? 1 : 0};transition:opacity .4s ${k * .08}s">
        <line x1="${x}" x2="${x}" y1="${top - 4}" y2="${Hh - bot + 4}" stroke="rgba(0,0,0,.5)" stroke-width="1.5"/>
        <rect x="${x - 38}" y="${top - 14}" width="76" height="22" rx="11" fill="#0b0618"/><text x="${x}" y="${top + 1}" text-anchor="middle" font-size="11" font-weight="600" fill="#fff">${lakh(total(D[i]))}/mo</text>
        <rect x="${x - 30}" y="${Hh - bot - 8}" width="60" height="22" rx="11" fill="#0b0618"/><text x="${x}" y="${Hh - bot + 7}" text-anchor="middle" font-size="10.5" fill="rgba(255,255,255,.7)">${esc(D[i].label)}</text></g>`; }).join("")}
      <line class="hl" y1="${top}" y2="${Hh - bot}" stroke="#fff" stroke-width="1.5" opacity="0"/><rect width="${W}" height="${Hh}" fill="transparent" class="hit"/>`;
    const hit = svg.querySelector(".hit"), hl = svg.querySelector(".hl");
    hit.onpointermove = (e) => { const r = svg.getBoundingClientRect(), z = r.width / W, x = (e.clientX - r.left) / z; const i = Math.max(0, Math.min(n - 1, Math.round((x + 20) / (W + 40) * (n - 1)))); const p = D[i];
      hl.setAttribute("x1", X(i)); hl.setAttribute("x2", X(i)); hl.setAttribute("opacity", 1);
      showTip(r.left + X(i) * z, r.top + (mid - lay[i].abc) * z, `${p.label} · projected sales`, [["Tier 3", lakh(p.t3, 2), COL.t3], ["Tier 2", lakh(p.t2, 2), COL.t2], ["Tier 1", lakh(p.t1, 2), COL.t1], ["Network", lakh(total(p), 2)]]); };
    hit.onpointerleave = () => { hl.setAttribute("opacity", 0); hideTip(); };
  }
  function updateNW() {
    const D = series(), sum = D.reduce((a, p) => a + total(p), 0), first = D[0] ? total(D[0]) : 0, last = D.length ? total(D[D.length - 1]) : 0;
    nwNum.count(sum);
    nw.querySelector(".nwd").textContent = first ? `↑ ${Math.round((last - first) / first * 100)}% ramp` : "";
    nw.querySelector(".nwc").textContent = `over ${D.length} months · ${data.slots.approved} approved partner${data.slots.approved === 1 ? "" : "s"} · base scenario`;
    cancelAnimationFrame(nwRaf); const t0 = performance.now(); grow = 0;
    const f = (now) => { grow = reduce ? 1 : Math.min(1, (now - t0) / 1100); drawNW(); if (grow < 1) nwRaf = RAF(f); }; nwRaf = RAF(f);
  }

  /* ---- Decision mix: half gauge of ticks ---- */
  const al = $("alloc");
  al.innerHTML = `${bg(GR.graph)}<div class="in-c"><div class="row" style="justify-content:space-between"><div class="ttl">Decision mix</div><span class="chip">${data.mix.reduce((a, m) => a + m.value, 0)} applications</span></div>
    <svg class="alg" width="300" height="168" viewBox="-150 -150 300 168" style="position:absolute;left:50%;margin-left:-150px;top:64px" aria-hidden="true"></svg>
    <div class="all" style="position:absolute;left:22px;right:22px;bottom:16px"></div></div><div class="rim"></div>`;
  function updateMix() {
    const tot = data.mix.reduce((a, m) => a + m.value, 0) || 1, n = 56, svg = al.querySelector(".alg"); let s = "", acc = 0;
    const bounds = data.mix.map((m) => (acc += m.value / tot));
    for (let i = 0; i <= n; i++) { const f = i / n, a = 180 + f * 180, k = Math.max(0, bounds.findIndex((b) => f <= b + 1e-9)); const [x1, y1] = P2(136, a), [x2, y2] = P2(i % 7 === 0 ? 112 : 118, a);
      s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${data.mix[k]?.color ?? "#555"}" stroke-width="3.2" stroke-linecap="round" style="opacity:0;animation:tk .4s ${i * 12}ms forwards"/>`; }
    const share = Math.round(((data.mix[0]?.value ?? 0) + (data.mix[1]?.value ?? 0)) / tot * 100);
    s += `<text y="-22" text-anchor="middle" font-weight="200" font-size="50" fill="#fff" letter-spacing="-2">${share}<tspan font-size="17" dy="-24" fill="${T2}">%</tspan></text><text y="0" text-anchor="middle" font-size="12" fill="${T3}">approved or conditional</text>`;
    svg.innerHTML = `<style>@keyframes tk{to{opacity:1}}</style>` + s;
    al.querySelector(".all").innerHTML = data.mix.filter((m) => m.value).map((m, i) => `<div class="row" style="height:26px;${i ? "border-top:1px solid rgba(255,255,255,.08)" : ""}"><i style="width:8px;height:8px;border-radius:50%;background:${m.color}"></i><span style="flex:1;font-size:12.5px;font-weight:600">${esc(m.label)}</span><span class="mono muted" style="width:40px;text-align:right">${Math.round(m.value / tot * 100)}%</span><span class="mono" style="width:30px;text-align:right;font-size:13px">${m.value}</span></div>`).join("");
  }

  /* ---- KPI: brand revenue (accent tile) ---- */
  const ret = $("ret");
  ret.innerHTML = `${bg(GR.saffron)}<div class="in-c" style="color:#1a1205"><div class="row" style="justify-content:space-between"><div class="cap" style="color:rgba(26,18,5,.6)">Brand revenue · ${Math.round(data.brand.months / 12)} yrs</div><span class="chip">${data.brand.royaltyPct}% royalty</span></div>
    <div style="position:absolute;left:20px;bottom:32px;display:flex;align-items:center;gap:8px"><svg width="26" height="32" viewBox="0 0 34 40" aria-hidden="true"><path d="M17 37V5M5 17L17 5l12 12" fill="none" stroke="#1a1205" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span class="big rtv" style="font-size:44px;font-weight:300">₹0L</span></div>
    <div class="rtp" style="position:absolute;left:22px;bottom:12px;font-size:11.5px;color:rgba(26,18,5,.65)">Fee ${lakh(data.brand.feeLakh)} + royalty ${lakh(data.brand.royaltyLakh)} · estimate</div></div><div class="rim"></div>`;
  const updateRet = () => tween(ret.querySelector(".rtv"), data.brand.totalLakh, (v) => lakh(v));

  /* ---- KPI: slots filled with tick ruler ---- */
  const cash = $("cash");
  cash.innerHTML = `<div class="in-c"><div class="row" style="justify-content:space-between"><div class="cap">Real slots filled</div><span class="muted">capacity</span></div>
    <div class="row" style="margin-top:14px;align-items:baseline;justify-content:space-between"><span class="big csv" style="font-size:38px">0</span><span class="mono" style="font-size:18px;font-weight:500">/ ${data.slots.total}</span></div>
    <svg class="cst" height="22" style="position:absolute;left:22px;bottom:20px;width:calc(100% - 44px)" aria-hidden="true"></svg></div>`;
  function updateCash() { tween(cash.querySelector(".csv"), data.slots.filled, (x) => Math.round(x).toString());
    const svg = cash.querySelector(".cst"), W = svg.getBoundingClientRect().width || 220, n = 36, f = data.slots.total ? data.slots.filled / data.slots.total : 0; let s = "";
    for (let i = 0; i < n; i++) { const x = 1 + i * (W - 2) / (n - 1), on = i / (n - 1) <= f && f > 0; s += `<line x1="${x}" x2="${x}" y1="${i % 6 === 0 ? 2 : 8}" y2="20" stroke="${on ? ACC : "rgba(255,255,255,.25)"}" stroke-width="1.6" stroke-linecap="round" style="transition:stroke .2s ${i * 14}ms"/>`; }
    svg.innerHTML = s; }

  /* ---- KPI: upcoming deadlines ---- */
  const pay = $("pay");
  pay.innerHTML = `<div class="in-c" style="padding-bottom:12px"><div class="row" style="justify-content:space-between"><div class="cap">Next deadlines</div><span class="muted">${data.deadlines.length} open</span></div>
    <div style="margin-top:8px">${data.deadlines.slice(0, 3).map((d, i) => `<div class="row" style="height:34px;${i ? "border-top:1px solid rgba(255,255,255,.08)" : ""}" title="${esc(d.what)}"><i style="width:24px;height:24px;border-radius:8px;background:rgba(245,165,36,.18);color:${ACC};display:grid;place-items:center;font-weight:700;font-size:11px;font-style:normal">${esc(d.name.charAt(0))}</i><span style="flex:1;font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.name)}</span><span class="muted mono" style="font-size:11.5px">${esc(d.date)}</span></div>`).join("") || `<p class="muted">No open deadlines.</p>`}</div></div>`;

  /* ---- KPI: territory fill ---- */
  const goals = $("goals");
  goals.innerHTML = `<div class="in-c"><div class="row" style="justify-content:space-between"><div class="cap">Territory fill</div><span class="muted">${data.territories.length} territories</span></div>
    ${data.territories.slice(0, 2).map((t, k) => `<div style="margin-top:${k ? 14 : 16}px"><div class="row" style="justify-content:space-between;font-size:12.5px;font-weight:600"><span>${esc(t.id)} · ${esc(t.city)}</span><span class="mono" style="font-weight:500">${t.filled}<span class="muted"> of ${t.capacity}</span></span></div>
      <svg width="100%" height="12" style="margin-top:8px;display:block" class="gl" data-f="${t.capacity ? t.filled / t.capacity : 0}" aria-hidden="true"></svg></div>`).join("")}</div>`;
  function updateGoals() { RAF(() => goals.querySelectorAll(".gl").forEach((svg, k) => { const W = svg.getBoundingClientRect().width, n = 40, f = +svg.dataset.f; let s = "";
    for (let i = 0; i < n; i++) { const x = 1 + i * (W - 2) / (n - 1), on = f > 0 && i / (n - 1) <= f; s += `<line x1="${x}" x2="${x}" y1="${i % 8 === 0 ? 0 : 4}" y2="12" stroke="${on ? ACC : "rgba(255,255,255,.25)"}" stroke-width="1.6" stroke-linecap="round" style="opacity:0;animation:tk2 .3s ${300 + k * 150 + i * 12}ms forwards"/>`; }
    svg.innerHTML = "<style>@keyframes tk2{to{opacity:1}}</style>" + s; })); }

  /* ---- Sales vs royalty: mirrored waves ---- */
  const flow = $("flow");
  flow.innerHTML = `${bg(GR.rose)}<div class="in-c"><div class="row" style="justify-content:space-between"><div><div class="ttl">Sales and royalty</div><div class="muted flm" style="margin-top:4px"></div></div>
    <div class="legend" style="flex-direction:column;gap:4px;align-items:flex-end"><span><i style="background:#fff"></i>Partner sales</span><span><i style="background:#FFD0DC"></i>Brand royalty</span></div></div>
    <svg class="fls" style="position:absolute;left:0;bottom:10px" aria-hidden="true"></svg></div><div class="rim"></div>`;
  let flowRaf = 0;
  function updateFlow(instant) {
    const D = series(), R = data.royalty.slice(0, S.period), svg = flow.querySelector(".fls"), W = flow.clientWidth, Hh = 232, L = 46, Rx = W - 30, mid = Hh / 2, lab = 14, amp = mid - lab - 10;
    svg.setAttribute("width", W); svg.setAttribute("height", Hh); svg.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
    flow.querySelector(".flm").innerHTML = `Royalty <span style="color:${ACC}">${lakh(R.reduce((a, b) => a + b, 0), 1)}</span> over ${D.length} months`;
    if (D.length < 2) { svg.innerHTML = ""; return; }
    const sales = D.map(total), maxS = Math.max(...sales, .01), maxR = Math.max(...R, .001), X = (i) => L + i / (D.length - 1) * (Rx - L);
    cancelAnimationFrame(flowRaf); const t0 = instant ? -1e6 : performance.now();
    const frame = (now) => { const g = ease(reduce ? 1 : Math.min(1, (now - t0) / 1200)); let s = "";
      [.5, 1].forEach((f) => { const yT = mid - lab - f * amp, yB = mid + lab + f * amp;
        s += `<line x1="${L}" x2="${Rx}" y1="${yT}" y2="${yT}" stroke="${HAIR}"/><line x1="${L}" x2="${Rx}" y1="${yB}" y2="${yB}" stroke="${HAIR}"/>
          <text x="${L - 8}" y="${yT + 3.5}" text-anchor="end" font-size="10" fill="${T3}">${lakh(maxS * f)}</text><text x="${L - 8}" y="${yB + 3.5}" text-anchor="end" font-size="10" fill="${T3}">${lakh(maxR * f, 2)}</text>`; });
      const step = Math.max(1, Math.ceil(D.length / 6));
      D.forEach((p, i) => { if (i % step === 0 || i === D.length - 1) s += `<text x="${X(i)}" y="${mid + 4}" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.75)">${esc(p.label)}</text>`; });
      s += `<path d="${smooth(sales.map((v, i) => [X(i), mid - lab - v / maxS * amp * g]))}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`;
      s += `<path d="${smooth(R.map((v, i) => [X(i), mid + lab + v / maxR * amp * g]))}" fill="none" stroke="#FFD0DC" stroke-width="2.4" stroke-linecap="round"/>`;
      s += `<line class="hl" y1="10" y2="${Hh - 10}" stroke="#fff" stroke-opacity=".5" opacity="0"/><rect class="hit" x="${L - 10}" width="${Rx - L + 20}" height="${Hh}" fill="transparent"/>`;
      svg.innerHTML = s;
      const hit = svg.querySelector(".hit"), hl = svg.querySelector(".hl");
      hit.onpointermove = (e) => { const r = svg.getBoundingClientRect(), z = r.width / W, x = (e.clientX - r.left) / z, i = Math.max(0, Math.min(D.length - 1, Math.round((x - L) / (Rx - L) * (D.length - 1))));
        hl.setAttribute("x1", X(i)); hl.setAttribute("x2", X(i)); hl.setAttribute("opacity", 1);
        showTip(r.left + X(i) * z, r.top + (mid - lab - sales[i] / maxS * amp) * z, D[i].label, [["Partner sales", lakh(sales[i], 2), "#fff"], ["Brand royalty", lakh(R[i], 2), "#FFD0DC"]]); };
      hit.onpointerleave = () => { hl.setAttribute("opacity", 0); hideTip(); };
      if (g < 1) flowRaf = RAF(frame); };
    flowRaf = RAF(frame);
  }

  /* ---- Territories: share bar + sparkline rows ---- */
  const tr = $("terr");
  const TT = [...data.territories].sort((a, b) => b.salesLakh - a.salesLakh).slice(0, 3);
  const totT = TT.reduce((a, t) => a + t.salesLakh, 0) || 1;
  const spark = (d, id) => { if (d.length < 2) return ""; const W = 92, H = 30, lo = Math.min(...d), hi = Math.max(...d), pad = (hi - lo) * .15 || 1, Y = (v) => H - 3 - (v - lo + pad) / (hi - lo + 2 * pad) * (H - 6);
    const P = d.map((v, i) => [2 + i / (d.length - 1) * (W - 6), Y(v)]), e = P[P.length - 1];
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><linearGradient id="sp${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <path d="${smooth(P)}L${e[0]},${H}L${P[0][0]},${H}Z" fill="url(#sp${id})"/><path d="${smooth(P)}" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="${e[0]}" cy="${e[1]}" r="3" fill="${ACC}"/></svg>`; };
  tr.innerHTML = `${bg(GR.teal)}<div class="in-c"><div class="row" style="justify-content:space-between"><div class="ttl">Territories</div><span class="muted">${data.brand.months} mo sales</span></div>
    <div class="row" style="margin-top:12px;align-items:flex-end;justify-content:space-between"><span class="big trv" style="font-size:34px">₹0L</span><span class="muted" style="padding-bottom:4px">top ${TT.length}</span></div>
    <div style="margin-top:14px"><div style="display:flex;gap:3px;height:6px">${TT.map((t, i) => `<div class="trs" style="flex:0 0 calc(${t.salesLakh / totT * 100}% - 2px);border-radius:3px;background:rgba(255,255,255,${[.95, .6, .32][i]});transform-origin:left;transform:scaleX(0);transition:transform .8s var(--ease) ${.1 + i * .1}s"></div>`).join("")}</div>
      <div style="display:flex;gap:3px;margin-top:7px">${TT.map((t) => `<span class="muted" style="flex:0 0 calc(${t.salesLakh / totT * 100}% - 2px);font-size:11px;white-space:nowrap;overflow:hidden">${esc(t.id)} ${Math.round(t.salesLakh / totT * 100)}%</span>`).join("")}</div></div>
    <div style="position:absolute;left:22px;right:22px;bottom:12px">${TT.map((t, i) => `<div class="row" style="height:46px;${i ? "border-top:1px solid rgba(255,255,255,.1)" : ""}"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600">${esc(t.id)} · ${esc(t.city)}</div><div class="muted" style="font-size:11px">${t.filled}/${t.capacity} slots</div></div>${spark(t.spark, i)}<div style="width:72px;text-align:right" class="mono"><div style="font-size:13px">${lakh(t.salesLakh, 0)}</div></div></div>`).join("")}</div></div><div class="rim"></div>`;
  function updateTerr() { tween(tr.querySelector(".trv"), totT, (v) => lakh(v, 0)); RAF(() => RAF(() => tr.querySelectorAll(".trs").forEach((b) => (b.style.transform = "scaleX(1)")))); }

  /* ---- Applications by status: capsule columns ---- */
  const st = $("stat");
  st.innerHTML = `${bg(GR.violet)}<div class="in-c"><div class="ttl">By status</div>
    <div style="margin-top:12px"><span class="big stv" style="font-size:34px">0</span></div><div class="row" style="margin-top:6px;gap:8px"><span class="delta">${data.slots.approved} approved</span><span class="muted">this run</span></div>
    <svg class="sts" style="position:absolute;left:16px;bottom:12px" aria-hidden="true"></svg></div><div class="rim"></div>`;
  function updateStat(instant) {
    if (!instant) tween(st.querySelector(".stv"), data.statuses.reduce((a, x) => a + x.count, 0), (x) => Math.round(x).toString());
    const svg = st.querySelector(".sts"), W = st.clientWidth - 32, Hh = 150, pb = 18, cols = data.statuses.length, bw = Math.min(22, (W - 10) / cols - 6), max = Math.max(1, ...data.statuses.map((x) => x.count)), gap = cols > 1 ? (W - 8 - bw * cols) / (cols - 1) : 0;
    svg.setAttribute("width", W); svg.setAttribute("height", Hh);
    const Y = (x) => (Hh - pb) * (1 - x / max); let s = "";
    data.statuses.forEach((x, i) => { const X0 = 4 + i * (bw + gap);
      s += `<rect x="${X0}" y="${Y(max)}" width="${bw}" height="${Hh - pb - Y(max)}" rx="${bw / 2}" fill="rgba(0,0,0,.25)"/>
        <rect class="sb" x="${X0}" y="${Hh - pb}" width="${bw}" height="0" rx="${bw / 2}" fill="${x.highlight ? ACC : "#fff"}" data-y="${Y(x.count)}" data-h="${Hh - pb - Y(x.count)}" style="transition:y .8s var(--ease) ${i * 70}ms,height .8s var(--ease) ${i * 70}ms"/>
        <text x="${X0 + bw / 2}" y="${Hh - 3}" text-anchor="middle" font-size="9.5" fill="${x.highlight ? "#fff" : T3}">${esc(x.label.slice(0, 4))}</text>
        <rect class="hit" x="${X0 - 3}" y="0" width="${bw + 6}" height="${Hh}" fill="transparent" data-i="${i}"/>`; });
    svg.innerHTML = s;
    RAF(() => RAF(() => svg.querySelectorAll(".sb").forEach((b) => { b.setAttribute("y", b.dataset.y); b.setAttribute("height", b.dataset.h); })));
    svg.querySelectorAll(".hit").forEach((h) => { h.onpointermove = (e) => { const x = data.statuses[+h.dataset.i]; showTip(e.clientX, e.clientY, x.label, [["Applications", String(x.count)]]); }; h.onpointerleave = hideTip; });
  }

  /* ---- controls + lifecycle ---- */
  const seg = $("period");
  seg.innerHTML = PERIODS.map((p) => `<button type="button" aria-pressed="${S.period === p}">${p}M</button>`).join("");
  seg.querySelectorAll("button").forEach((b, i) => (b.onclick = () => { S.period = PERIODS[i]; seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b)); updateNW(); updateFlow(); }));
  function updateAll() { updateNW(); updateMix(); updateRet(); updateCash(); updateGoals(); updateFlow(); updateTerr(); updateStat(); }
  let rz; const ro = new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => { cancelAnimationFrame(nwRaf); grow = 1; drawNW(); updateFlow(true); updateStat(true); updateCash(); updateGoals(); }, 120); });
  ["nw", "flow", "stat", "cash"].forEach((id) => ro.observe($(id)));
  RAF(() => { $("grid").classList.add("in"); root.querySelectorAll(".card").forEach((c, i) => (c.style.transitionDelay = (i * 60) + "ms")); updateAll(); });
  return () => { alive = false; frames.forEach((f) => cancelAnimationFrame(f)); ro.disconnect(); clearTimeout(rz); };
}

export function FranchiseBento({ data, title = "Network overview", subtitle = "", className = "", style }: { data: FranchiseBentoData; title?: string; subtitle?: string; className?: string; style?: React.CSSProperties }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const stop = mount(node, data, { title, subtitle });
    return () => { stop(); node.innerHTML = ""; };
  }, [data, title, subtitle]);
  return (<><style>{CSS}</style><div ref={ref} className={`frb ${className}`} style={style} /></>);
}

export default FranchiseBento;
