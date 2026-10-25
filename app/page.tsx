"use client";
import { motion } from "framer-motion";
import { LampContainer } from "@/components/ui/lamp";
import Spectacles from "@/components/Spectacles";
import UploadForm from "@/components/UploadForm";
import Icon from "@/components/Icon";
import brand from "@/config/brand.json";

const rise = (delay: number) => ({ initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.8, ease: "easeOut" as const } });

export default function Landing() {
  return (
    <main className="landing">
      <header className="landing-top">
        <span className="brand" style={{ margin: 0 }}><span className="logo"><Icon name="glasses" /></span>{brand.name}</span>
        <a href="/how">How this decides</a>
      </header>
      <LampContainer>
        <Spectacles delay={0.9} />
        <motion.p className="landing-kicker" {...rise(1.5)}>{brand.tagline}</motion.p>
        <motion.h1 className="landing-title" {...rise(1.65)}>Welcome to <span>{brand.name}</span></motion.h1>
        <motion.p className="landing-sub" {...rise(1.85)}>
          Upload the applications workbook. Every applicant gets a clear decision, the reason behind it, an owner and the next step — and approved partners get a ready-to-ship profile.
        </motion.p>
        <motion.div className="landing-card glass" {...rise(2.05)}>
          <UploadForm />
          <p className="muted small" style={{ margin: "10px 0 0" }}>No login. Each upload opens its own private session.</p>
        </motion.div>
      </LampContainer>
    </main>
  );
}
