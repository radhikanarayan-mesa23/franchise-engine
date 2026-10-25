"use client";
import React from "react";
import { motion } from "framer-motion";

/* Lamp light, adapted from Aceternity's LampContainer: same structure and motion timings,
   but in plain CSS (no Tailwind) and with beams faded by CSS masks instead of boxes painted
   in the background colour, so it sits on any gradient. */

const T = { delay: 0.3, duration: 0.8, ease: "easeInOut" as const };

export const LampContainer = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`lamp ${className}`}>
    <div className="lamp-stage">
      <motion.div className="lamp-beam left" initial={{ opacity: 0.4, width: "15rem" }} animate={{ opacity: 1, width: "30rem" }} transition={T} />
      <motion.div className="lamp-beam right" initial={{ opacity: 0.4, width: "15rem" }} animate={{ opacity: 1, width: "30rem" }} transition={T} />
      <div className="lamp-glow" />
      <motion.div className="lamp-core" initial={{ width: "8rem" }} animate={{ width: "16rem" }} transition={T} />
      <motion.div className="lamp-line" initial={{ width: "15rem" }} animate={{ width: "30rem" }} transition={T} />
    </div>
    <div className="lamp-content">{children}</div>
  </div>
);

export default LampContainer;
