// Small spectacles glyph used as the map pin, coloured by pin state.
export type PinKind = "taken" | "free" | "store" | "outside" | "elsewhere";

const STYLE: Record<PinKind, { fill: string; stroke: string; glow: string }> = {
  taken: { fill: "#0DB8D3", stroke: "#ffffff", glow: "rgba(13,184,211,.75)" },
  free: { fill: "rgba(255,255,255,.12)", stroke: "#ffffff", glow: "rgba(255,255,255,.45)" },
  store: { fill: "#5d7686", stroke: "#cfe6f0", glow: "rgba(0,0,0,0)" },
  outside: { fill: "#b3b9ff", stroke: "#ffffff", glow: "rgba(179,185,255,.6)" },
  elsewhere: { fill: "rgba(255,255,255,.06)", stroke: "rgba(255,255,255,.5)", glow: "rgba(0,0,0,0)" },
};

/** SVG markup for the glasses glyph (44×28 viewBox). */
export function glassesSvg(kind: PinKind, selected = false, contested = false) {
  const s = STYLE[kind];
  const dash = kind === "free" ? ` stroke-dasharray="3 2"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="28" viewBox="0 0 44 28">
    <defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>
    <g filter="url(#g)" opacity="${selected ? 1 : 0.8}"><rect x="5" y="8" width="14" height="11" rx="5" fill="${s.glow}"/><rect x="25" y="8" width="14" height="11" rx="5" fill="${s.glow}"/></g>
    ${contested ? `<rect x="1" y="4" width="42" height="19" rx="9" fill="none" stroke="#ffb46b" stroke-width="1.5" stroke-dasharray="3 3"/>` : ""}
    <path d="M3 10 L6 9 M41 10 L38 9" stroke="${s.stroke}" stroke-width="1.6" stroke-linecap="round"/>
    <rect x="6" y="8" width="13" height="11" rx="5" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${selected ? 2.4 : 1.7}"${dash}/>
    <rect x="25" y="8" width="13" height="11" rx="5" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${selected ? 2.4 : 1.7}"${dash}/>
    <path d="M19 11 Q22 8 25 11" fill="none" stroke="${s.stroke}" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M8 11 Q10 9.5 12 10" stroke="#fff" stroke-opacity=".7" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M27 11 Q29 9.5 31 10" stroke="#fff" stroke-opacity=".7" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  </svg>`;
}

export const glassesDataUrl = (kind: PinKind, selected = false, contested = false) =>
  "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(glassesSvg(kind, selected, contested));
