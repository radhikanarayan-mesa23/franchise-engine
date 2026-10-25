"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

/* Beams background, adapted from the "BeamsBackground" component: same drifting, pulsing,
   blurred light beams on a canvas. Changes: plain CSS (no Tailwind), renders children,
   tuned for our light icy-blue theme (deeper blues, more opacity), DPR handled without
   compounding scale on resize, and motion paused for reduced-motion users.
   framer-motion is the same API as the `motion` package, which this project already ships. */

interface Beam { x: number; y: number; width: number; length: number; angle: number; speed: number; opacity: number; hue: number; pulse: number; pulseSpeed: number }

const createBeam = (w: number, h: number): Beam => ({
  x: Math.random() * w * 1.5 - w * 0.25, y: Math.random() * h * 1.5 - h * 0.25,
  width: 30 + Math.random() * 60, length: h * 2.5, angle: -35 + Math.random() * 10,
  speed: 0.6 + Math.random() * 1.2, opacity: 0.12 + Math.random() * 0.16,
  hue: 195 + Math.random() * 45, pulse: Math.random() * Math.PI * 2, pulseSpeed: 0.02 + Math.random() * 0.03,
});

export function BeamsBackground({ className = "", children, intensity = "strong" }: { className?: string; children?: React.ReactNode; intensity?: "subtle" | "medium" | "strong" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beams = useRef<Beam[]>([]);
  const frame = useRef(0);
  const opacity = { subtle: 0.7, medium: 0.85, strong: 1 }[intensity];

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      beams.current = Array.from({ length: 30 }, () => createBeam(W, H));
    };
    resize();
    window.addEventListener("resize", resize);

    const reset = (b: Beam, i: number, n: number) => {
      const spacing = W / 3;
      b.y = H + 100; b.x = (i % 3) * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.5;
      b.width = 100 + Math.random() * 100; b.speed = 0.5 + Math.random() * 0.4;
      b.hue = 195 + (i * 45) / n; b.opacity = 0.2 + Math.random() * 0.1;
    };
    const draw = (b: Beam) => {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate((b.angle * Math.PI) / 180);
      const a = b.opacity * (0.8 + Math.sin(b.pulse) * 0.2) * opacity;
      const g = ctx.createLinearGradient(0, 0, 0, b.length);
      const c = (k: number) => `hsla(${b.hue}, 88%, 56%, ${k})`;
      g.addColorStop(0, c(0)); g.addColorStop(0.1, c(a * 0.5)); g.addColorStop(0.4, c(a)); g.addColorStop(0.6, c(a)); g.addColorStop(0.9, c(a * 0.5)); g.addColorStop(1, c(0));
      ctx.fillStyle = g; ctx.fillRect(-b.width / 2, 0, b.width, b.length); ctx.restore();
    };
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.filter = "blur(35px)";
      const n = beams.current.length;
      beams.current.forEach((b, i) => {
        if (!reduce) { b.y -= b.speed; b.pulse += b.pulseSpeed; }
        if (b.y + b.length < -100) reset(b, i, n);
        draw(b);
      });
      if (!reduce) frame.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(frame.current); };
  }, [opacity]);

  return (
    <div className={`beams ${className}`}>
      <canvas ref={canvasRef} className="beams-canvas" />
      <motion.div className="beams-veil" animate={{ opacity: [0.05, 0.15, 0.05] }} transition={{ duration: 10, ease: "easeInOut", repeat: Infinity }} />
      <div className="beams-content">{children}</div>
    </div>
  );
}

export default BeamsBackground;
