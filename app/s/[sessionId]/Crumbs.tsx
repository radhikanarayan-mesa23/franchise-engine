"use client";
import { usePathname } from "next/navigation";
import brand from "@/config/brand.json";

const TITLES: Record<string, string> = { upload: "Upload", applications: "Applications", approved: "Approved", pins: "Location map", review: "Review queue", policy: "Policy", a: "Applicant" };

export default function Crumbs() {
  const parts = usePathname().split("/").filter(Boolean);
  const key = parts[2] ?? "applications";
  const title = parts[4] === "pack" ? `${brand.name} partner pack` : key === "approved" && parts[3] ? "Profile snapshot" : TITLES[key] ?? "Dashboard";
  return <div className="crumbs">{brand.name} / {title}<b>{title}{key === "a" && parts[3] ? ` · ${decodeURIComponent(parts[3])}` : ""}</b></div>;
}
