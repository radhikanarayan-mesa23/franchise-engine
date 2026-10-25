// Small stroke icons (24px grid) so the UI needs no icon library.
const PATHS: Record<string, string> = {
  upload: "M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  check: "M5 12.5l4.5 4.5L19 7.5",
  pin: "M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12zm0-9.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z",
  sliders: "M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4",
  users: "M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3 3 0 100-6 3 3 0 000 6zM21 19v-1a4 4 0 00-3-3.9M16 4.1a3 3 0 010 5.8",
  flag: "M5 21V4m0 0h11l-2 4 2 4H5",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  steps: "M5 12h14M13 6l6 6-6 6",
  book: "M5 4h10a4 4 0 014 4v12H9a4 4 0 01-4-4V4zM5 16a4 4 0 014-4h10",
  glasses: "M2 10h2.5M19.5 10H22M10 11.5c1.2-1 2.8-1 4 0M4.5 9.5a3 3 0 013-2.5h0a3 3 0 013 3v1.5a3.5 3.5 0 01-7 0zM19.5 9.5a3 3 0 00-3-2.5h0a3 3 0 00-3 3v1.5a3.5 3.5 0 007 0z",
};
export default function Icon({ name }: { name: keyof typeof PATHS | string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.grid} />
    </svg>
  );
}
