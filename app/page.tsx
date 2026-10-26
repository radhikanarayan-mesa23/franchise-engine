"use client";
import { motion } from "framer-motion";
import { Bodoni_Moda } from "next/font/google";
import { BeamsBackground } from "@/components/ui/beams-background";
import GoToDashboard from "@/components/GoToDashboard";
import ThemeToggle from "@/components/ThemeToggle";
import Icon from "@/components/Icon";
import brand from "@/config/brand.json";

const display = Bodoni_Moda({ subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"] });

const rise = (delay: number) => ({ initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.9, ease: [0.22, 1, 0.36, 1] as const } });

export default function Landing() {
  return (
    <BeamsBackground intensity="strong">
      <header className="landing-top">
        <span className="brand" style={{ margin: 0 }}><span className="logo"><Icon name="glasses" /></span>{brand.name}</span>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}><a href="/how">How this decides</a><ThemeToggle /></div>
      </header>
      <main className="landing-hero">
        <motion.p className="landing-kicker" {...rise(0.2)}>Welcome to</motion.p>
        <motion.h1 className={`wordmark ${display.className}`} {...rise(0.35)} data-text={brand.name}>{brand.name}</motion.h1>
        <motion.p className="landing-tag" {...rise(0.55)}>{brand.tagline}</motion.p>
        <motion.div style={{ marginTop: 34 }} {...rise(0.8)}><GoToDashboard /></motion.div>
      </main>
    </BeamsBackground>
  );
}
