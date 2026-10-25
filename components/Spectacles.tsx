"use client";
import { motion } from "framer-motion";
import brand from "@/config/brand.json";

/** Premium spectacles in SVG: thin metal frame, tinted gradient lenses, a light sweep across the glass.
    Phases in (blur → sharp, fade, slight drop) as the lamp light arrives. */
export default function Spectacles({ delay = 0.9 }: { delay?: number }) {
  return (
    <motion.div
      className="specs"
      initial={{ opacity: 0, y: -28, scale: 0.9, filter: "blur(14px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ delay, duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <svg viewBox="0 0 520 190" role="img" aria-label={`${brand.name} spectacles`}>
        <defs>
          <linearGradient id="lvMetal" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#0d2b45" /><stop offset=".45" stopColor="#3f7fae" /><stop offset=".55" stopColor="#d9f2fc" /><stop offset="1" stopColor="#0d2b45" />
          </linearGradient>
          <linearGradient id="lvLens" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#5bc0eb" stopOpacity=".55" /><stop offset=".6" stopColor="#1e88d8" stopOpacity=".28" /><stop offset="1" stopColor="#0d2b45" stopOpacity=".5" />
          </linearGradient>
          <linearGradient id="lvSweep" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".85" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id="lvLenses">
            <path d="M40 58c0-14 10-22 26-22h128c18 0 28 9 28 26 0 40-26 76-90 76-60 0-92-34-92-80z" />
            <path d="M480 58c0-14-10-22-26-22H326c-18 0-28 9-28 26 0 40 26 76 90 76 60 0 92-34 92-80z" />
          </clipPath>
          <filter id="lvShadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="10" floodColor="#0d2b45" floodOpacity=".22" /></filter>
        </defs>
        <g filter="url(#lvShadow)">
          {/* temples, angled back */}
          <path d="M42 56 L8 44" stroke="url(#lvMetal)" strokeWidth="5" strokeLinecap="round" />
          <path d="M478 56 L512 44" stroke="url(#lvMetal)" strokeWidth="5" strokeLinecap="round" />
          {/* lenses */}
          <g clipPath="url(#lvLenses)">
            <rect width="520" height="190" fill="url(#lvLens)" />
            <motion.rect y="0" width="90" height="190" fill="url(#lvSweep)" transform="skewX(-22)"
              initial={{ x: -160 }} animate={{ x: 640 }} transition={{ delay: delay + 1.0, duration: 1.4, ease: "easeInOut" }} />
            <ellipse cx="96" cy="62" rx="40" ry="10" fill="#fff" opacity=".35" />
            <ellipse cx="356" cy="62" rx="40" ry="10" fill="#fff" opacity=".35" />
          </g>
          {/* frame rims */}
          <path d="M40 58c0-14 10-22 26-22h128c18 0 28 9 28 26 0 40-26 76-90 76-60 0-92-34-92-80z" fill="none" stroke="url(#lvMetal)" strokeWidth="6" strokeLinejoin="round" />
          <path d="M480 58c0-14-10-22-26-22H326c-18 0-28 9-28 26 0 40 26 76 90 76 60 0 92-34 92-80z" fill="none" stroke="url(#lvMetal)" strokeWidth="6" strokeLinejoin="round" />
          {/* bridge and brow bar */}
          <path d="M222 60 C240 44, 280 44, 298 60" fill="none" stroke="url(#lvMetal)" strokeWidth="6" strokeLinecap="round" />
          <path d="M60 36 H460" stroke="url(#lvMetal)" strokeWidth="3" strokeLinecap="round" opacity=".9" />
          {/* nose pads and hinge studs */}
          <circle cx="232" cy="84" r="5" fill="#d9f2fc" stroke="#3f7fae" strokeWidth="1.5" />
          <circle cx="288" cy="84" r="5" fill="#d9f2fc" stroke="#3f7fae" strokeWidth="1.5" />
          <circle cx="44" cy="54" r="4.5" fill="#d9f2fc" /><circle cx="476" cy="54" r="4.5" fill="#d9f2fc" />
        </g>
      </svg>
    </motion.div>
  );
}
