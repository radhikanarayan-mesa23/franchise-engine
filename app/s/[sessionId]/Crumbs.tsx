"use client";
import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = { upload: "Upload", applications: "Applications", approved: "Approved", pins: "Location map", review: "Review queue", policy: "Policy", a: "Applicant" };

export default function Crumbs() {
  const parts = usePathname().split("/").filter(Boolean);
  const key = parts[2] ?? "applications";
  const title = parts[4] === "pack" ? "Partner pack" : TITLES[key] ?? "Dashboard";
  return <div className="crumbs">Dashboard / {title}<b>{title}{key === "a" && parts[3] ? ` · ${decodeURIComponent(parts[3])}` : ""}</b></div>;
}
