// Small spectacles glyph used as the map pin, coloured by pin state.
export type PinKind = "taken" | "free" | "store" | "outside" | "elsewhere";

const STYLE: Record<PinKind, { fill: string; stroke: string; glow: string }> = {
  taken: { fill: "#0DB8D3", stroke: "#ffffff", glow: "rgba(13,184,211,.75)" },
  free: { fill: "rgba(255,255,255,.12)", stroke: "#ffffff", glow: "rgba(255,255,255,.45)" },
  store: { fill: "#5d7686", stroke: "#cfe6f0", glow: "rgba(0,0,0,0)" },
  outside: { fill: "#b3b9ff", stroke: "#ffffff", glow: "rgba(179,185,255,.6)" },
  elsewhere: { fill: "rgba(255,255,255,.06)", stroke: "rgba(255,255,255,.5)", glow: "rgba(0,0,0,0)" },
};

/** SVG markup: glasses glyph inside a round badge (44×44 viewBox), coloured by state. */
export function glassesSvg(kind: PinKind, selected = false, contested = false) {
  const s = STYLE[kind];
  const ring = kind === "free" ? ` stroke-dasharray="4 3"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
    <circle cx="22" cy="22" r="20" fill="${s.glow}" opacity="${selected ? 0.9 : 0.55}"/>
    <circle cx="22" cy="22" r="16" fill="${kind === "free" ? "#0b2433" : s.fill}" stroke="${s.stroke}" stroke-width="${selected ? 2.6 : 1.8}"${ring}/>
    ${contested ? `<circle cx="22" cy="22" r="20.5" fill="none" stroke="#ffb46b" stroke-width="1.6" stroke-dasharray="3 3"/>` : ""}
    <g fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <rect x="11" y="18" width="9" height="7" rx="3"/><rect x="24" y="18" width="9" height="7" rx="3"/>
      <path d="M20 20.5 Q22 18.5 24 20.5"/><path d="M11 19.5 L9 18.5 M33 19.5 L35 18.5"/>
    </g>
  </svg>`;
}

export const glassesDataUrl = (kind: PinKind, selected = false, contested = false) =>
  "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(glassesSvg(kind, selected, contested));
