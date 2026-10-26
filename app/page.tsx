"use client";
import { motion } from "framer-motion";
import { Bodoni_Moda } from "next/font/google";
import { BeamsBackground } from "@/components/ui/beams-background";
import UploadForm from "@/components/UploadForm";
import Icon from "@/components/Icon";
import brand from "@/config/brand.json";

const display = Bodoni_Moda({ subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"] });

const rise = (delay: number) => ({ initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.9, ease: [0.22, 1, 0.36, 1] as const } });

export default function Landing() {
  return (
    <BeamsBackground intensity="strong">
      <header className="landing-top">
        <span className="brand" style={{ margin: 0 }}><span className="logo"><Icon name="glasses" /></span>{brand.name}</span>
        <a href="/how">How this decides</a>
      </header>
      <main className="landing-hero">
        <motion.p className="landing-kicker" {...rise(0.2)}>Welcome to</motion.p>
        <motion.h1 className={`wordmark ${display.className}`} {...rise(0.35)} data-text={brand.name}>{brand.name}</motion.h1>
        <motion.p className="landing-tag" {...rise(0.55)}>{brand.tagline}</motion.p>
        <motion.p className="landing-sub" {...rise(0.7)}>
          Upload the applications workbook. Every applicant gets a clear decision, the reason behind it, an owner and the next step, and approved partners get a ready-to-ship profile.
        </motion.p>
        <motion.div className="landing-card glass" {...rise(0.9)}>
          <UploadForm />
          <p className="muted small" style={{ margin: "10px 0 0" }}>No login. Each upload opens its own private session.</p>
        </motion.div>
      </main>
    </BeamsBackground>
  );
}
