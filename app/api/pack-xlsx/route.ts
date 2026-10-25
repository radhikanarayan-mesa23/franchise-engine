import * as XLSX from "xlsx";
import { getSession, latestSnapshots } from "@/lib/db/repo";
import { costSplit } from "@/lib/pack";

export const runtime = "nodejs";

/** Financials workbook for one applicant, from the same payback numbers the card and pack show. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const sessionId = u.searchParams.get("sessionId") ?? "", appId = u.searchParams.get("appId") ?? "";
  const session = await getSession(sessionId);
  const [snap] = session ? await latestSnapshots(sessionId, 1) : [];
  const d = snap?.decisions.find((x) => x.applicationId === appId);
  if (!session || !d?.payback) return new Response("Not found", { status: 404 });
  const p = d.payback;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Partner financials (estimate)", `${d.applicationId} ${d.name}`], ["Status", d.status], ["Policy version", d.policyVersion], ["Run", snap.runNo],
    ["Setup cost (₹ lakh)", p.setupCostLakh], ["Monthly sales at full ramp (₹ lakh)", p.monthlySalesLakh], ["Margin %", session.policy.payback.margin_pct],
    ["Nearest store (km)", p.nearestStoreKm ?? "unknown"], ["Cannibalisation cut applied", p.cannibalised ? "yes" : "no"],
    ["Note", "Estimates from brand policy assumptions, not a promise of earnings."],
  ]), "Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(costSplit(d, session.policy).map((s) => ({ Item: s.item, "Share %": s.pct, "₹ lakh": s.lakh }))), "Setup cost");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(p.scenarios.map((s) => ({ Scenario: s.name, "Sales %": s.salesPct, "Monthly profit (₹ lakh)": s.monthlyProfitLakh, "Break-even month": s.breakEvenMonth ?? "beyond horizon" }))), "Scenarios");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(p.ramp.map((r) => ({ Month: r.month, "Sales (₹ lakh)": r.salesLakh, "Profit (₹ lakh)": r.profitLakh, "Cumulative (₹ lakh)": r.cumulativeLakh }))), "Ramp (base)");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(buf, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${d.applicationId.replace(/[^\w-]/g, "_")}-financials.xlsx"`,
  } });
}
