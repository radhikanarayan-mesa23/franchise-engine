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
  // Projection: what the partner sells and what the brand earns (franchise fee + royalty on sales), per scenario.
  const be = policy.brand_economics;
  const months = be.projection_months;
  const feePct = (policy.investment_split_pct as Record<string, number>)[be.franchise_fee_item] ?? 0;
  const franchiseFee = round((setup * feePct) / 100, 2);
  const salesSeries = (pct: number) => Array.from({ length: months }, (_, i) => monthlySales * (pct / 100) * rampAt(i + 1));
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const projScen = pb.scenarios.map((sc) => {
    const series = salesSeries(sc.sales_pct);
    const sales = sum(series), royalty = (sales * be.royalty_pct_of_sales) / 100;
    return { name: sc.name, salesLakh: round(sales, 2), partnerProfitLakh: round((sales * pb.margin_pct) / 100, 2), royaltyLakh: round(royalty, 2), brandTotalLakh: round(royalty + franchiseFee, 2) };
  });
  const pctOf = (name: string, fallback: number) => pb.scenarios.find((x) => x.name === name)?.sales_pct ?? fallback;
  const [lo, ba, hi] = [salesSeries(pctOf("Low", base.sales_pct)), salesSeries(base.sales_pct), salesSeries(pctOf("High", base.sales_pct))];
  const yearMonths = Math.min(months, policy.calendar.months_per_year);
  const year1Sales = sum(ba.slice(0, yearMonths));
  return {
    projection: {
      months, royaltyPct: be.royalty_pct_of_sales, franchiseFeeLakh: franchiseFee, scenarios: projScen,
      monthly: ba.map((v, i) => ({ month: i + 1, low: round(lo[i], 2), base: round(v, 2), high: round(hi[i], 2) })),
      cumulativeProfit: (() => {
        let cl = 0, cb = 0, ch = 0;
        const m = pb.margin_pct / 100;
        return ba.map((v, i) => ({ month: i + 1, low: round((cl += lo[i] * m), 2), base: round((cb += v * m), 2), high: round((ch += hi[i] * m), 2) }));
      })(),
      year1: { salesLakh: round(year1Sales, 2), royaltyLakh: round((year1Sales * be.royalty_pct_of_sales) / 100, 2) },
    },
    setupCostLakh: setup, monthlySalesLakh: round(monthlySales, 2), cannibalised,
    nearestStoreKm: near ? round(near.km) : null, scenarios, breakEvenMonth: baseRun.be, ramp: baseRun.rows,
  };
}
