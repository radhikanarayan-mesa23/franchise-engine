"use client";
export default function SnapshotActions({ jsonHref, xlsxHref, packHref }: { jsonHref: string; xlsxHref: string; packHref: string }) {
  return (
    <div className="noprint" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button className="primary" onClick={() => window.print()}>Download snapshot (PDF)</button>
      <a className="btn" href={jsonHref}>Profile data (JSON)</a>
      <a className="btn" href={xlsxHref}>Financials (Excel)</a>
      <a className="btn" href={packHref}>Partner pack</a>
    </div>
  );
}
