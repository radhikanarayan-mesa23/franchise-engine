"use client";
import { useState } from "react";

export default function CopyButton({ text, label = "Copy message" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); }}>
      {done ? "✓ Copied" : label}
    </button>
  );
}
