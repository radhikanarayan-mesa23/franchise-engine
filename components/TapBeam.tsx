"use client";
import { useEffect } from "react";

/** Adds a one-shot light-beam outline to any button, chip or nav item when it is tapped. */
export default function TapBeam() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("button, .btn, .chip, .nav, .pin");
      if (!el || (el as HTMLButtonElement).disabled) return;
      el.classList.remove("beam-tap");
      void el.offsetWidth; // restart the animation on repeated taps
      el.classList.add("beam-tap");
      window.setTimeout(() => el.classList.remove("beam-tap"), 750);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);
  return null;
}
