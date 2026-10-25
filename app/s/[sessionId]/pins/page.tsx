import { getSession, latestSnapshots } from "@/lib/db/repo";
import { render } from "@/lib/reasons/render";
import { STATUS_CLASS } from "@/lib/ui";
import { resolveTerritories } from "@/lib/engine/territory";
import PinBoard, { type TerritoryCard } from "./PinBoard";

export default async function PinsTab({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const s = (await getSession(sessionId))!;
  const [snap] = await latestSnapshots(sessionId, 1);
  const byId = new Map(snap.decisions.map((d) => [d.applicationId, d]));
  const owners = new Map<string, string[]>();
  s.territories.forEach((t) => t.pins.forEach((p) => owners.set(p, [...(owners.get(p) ?? []), t.id])));
  const { pinOwner } = resolveTerritories(s.territories, s.stores, s.policy);
  const summary = new Map(snap.territories.map((t) => [t.id, t]));
  const order = s.policy.allocation.priority_order;

  const cards: TerritoryCard[] = [...s.territories]
    .sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority) || a.id.localeCompare(b.id))
    .map((t) => {
      const sum = summary.get(t.id);
      const inTerritory = snap.decisions.filter((d) => d.territoryId === t.id);
      return {
        id: t.id, city: t.city, tier: t.tier, priority: t.priority, openSlots: t.openSlots, realCapacity: sum?.realCapacity ?? 0,
        filled: inTerritory.filter((d) => d.assignedPin).length, priorities: order,
        flags: (sum?.flags ?? []).map((f) => `${f.code.replace(/_/g, " ")}: ${Object.values(f.params).join(", ")}`),
        pins: t.pins.map((pin) => {
          const store = s.stores.find((x) => x.pin === pin);
          const holder = snap.decisions.find((d) => d.assignedPin === pin);
          const appliedHere = s.applications.filter((a) => a.pin === pin).map((a) => byId.get(a.id)!).filter(Boolean)
            .sort((a, b) => (b.score?.total ?? -1) - (a.score?.total ?? -1));
          const other = (owners.get(pin) ?? []).filter((x) => x !== t.id);
          const ownedBy = pinOwner.get(pin);
          const elsewhere = ownedBy && ownedBy !== t.id;
          const why = elsewhere ? `Also listed in ${ownedBy}, which has higher priority (tie: lower ID), so the pin is decided there.`
            : store ? `Existing store ${store.id} (opened ${store.openedYear}) — the brand never opens two stores in one pin.`
            : holder ? `Assigned to ${holder.applicationId} ${holder.name} (score ${holder.score?.total}). ${holder.reasons.map(render).find((r) => r.includes(pin)) ?? ""}`
            : "Free — no applicant won this pin in the current run.";
          return {
            pin, state: elsewhere ? "store" : store ? "store" : holder ? "taken" : "free", label: elsewhere ? `in ${ownedBy}` : store ? store.id : holder ? holder.applicationId : "free", why,
            contested: appliedHere.length > 1, alsoIn: other,
            applicants: appliedHere.map((d) => ({ id: d.applicationId, name: d.name, status: d.status, cls: STATUS_CLASS[d.status], score: d.score?.total ?? null, reason: d.reasons[0] ? render(d.reasons[0]) : "" })),
          };
        }),
        candidates: snap.decisions.filter((d) => !d.assignedPin && s.applications.find((a) => a.id === d.applicationId)?.city.toLowerCase() === t.city.toLowerCase())
          .map((d) => ({ id: d.applicationId, label: `${d.applicationId} ${d.name} (${d.status}, ${d.score?.total ?? "–"})` })),
      };
    });

  return (
    <>
      <p className="muted">How pin codes were decided. Each territory&apos;s real capacity is its open slots, capped by pins with no existing store. Click a pin to see who wanted it and why it went where it did. Changes here are what-ifs: they change inputs and the engine re-decides everyone.</p>
      <div className="small" style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <span><span className="pin store" style={{ padding: "1px 8px" }}>ST</span> existing store</span>
        <span><span className="pin taken" style={{ padding: "1px 8px" }}>APP</span> assigned</span>
        <span><span className="pin free" style={{ padding: "1px 8px" }}>free</span> open</span>
        <span><span className="pin contested" style={{ padding: "1px 8px" }}>!</span> more than one applicant wanted it</span>
      </div>
      <PinBoard sessionId={sessionId} territories={cards} />
    </>
  );
}
