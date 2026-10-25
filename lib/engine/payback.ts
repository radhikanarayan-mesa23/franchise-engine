import type { Payback, Pin, Store, Tier } from "@/lib/types";
import { nearestStore } from "./geo";
import type { Policy } from "./policy";
import { round } from "./gates";

/** Single source of payback numbers for cards, packs, chat and export. Always an estimate. */
export function computePayback(tier: Tier, pin: Pin, stores: Store[], policy: Policy): Payback {
  const t = policy.tiers[tier];
  const pb = policy.payback;
  const near = nearestStore(pin, stores);
  const cannibalised = near !== null && near.km <= pb.cannibalisation_radius_km;
  const monthlySales = t.monthly_sales_lakh * (cannibalised ? 1 - pb.cannibalisation_sales_cut_pct / 100 : 1);
  const setup = t.min_investment_lakh;
  const ramp = pb.ramp_pct_by_month;
  const rampAt = (m: number) => ramp[Math.min(m - 1, ramp.length - 1)] / 100;

  const run = (salesPct: number) => {
    let cum = 0;
    const rows: Payback["ramp"] = [];
    let be: number | null = null;
    for (let m = 1; m <= pb.horizon_months; m++) {
      const sales = monthlySales * (salesPct / 100) * rampAt(m);
      const profit = sales * (pb.margin_pct / 100);
      cum += profit;
      rows.push({ month: m, salesLakh: round(sales, 2), profitLakh: round(profit, 2), cumulativeLakh: round(cum, 2) });
      if (be === null && cum >= setup) { be = m; break; }
    }
    return { rows, be, monthlyProfit: round(monthlySales * (salesPct / 100) * (pb.margin_pct / 100), 2) };
  };

  const scenarios = pb.scenarios.map((s) => { const r = run(s.sales_pct); return { name: s.name, salesPct: s.sales_pct, breakEvenMonth: r.be, monthlyProfitLakh: r.monthlyProfit }; });
  const base = pb.scenarios.find((s) => s.name === "Base") ?? pb.scenarios[Math.floor(pb.scenarios.length / 2)];
  const baseRun = run(base.sales_pct);
  return {
    setupCostLakh: setup, monthlySalesLakh: round(monthlySales, 2), cannibalised,
    nearestStoreKm: near ? round(near.km) : null, scenarios, breakEvenMonth: baseRun.be, ramp: baseRun.rows,
  };
}
