import { getSession, latestSnapshots } from "@/lib/db/repo";
import { render } from "@/lib/reasons/render";
import { STATUS_CLASS } from "@/lib/ui";
import { resolveTerritories } from "@/lib/engine/territory";
import MapView, { type TerritoryCard, type OutsideMarker } from "./MapView";
import pinCoords from "@/config/pins.json";

const coords = pinCoords as unknown as Record<string, [number, number] | string>;
const at = (pin: string) => (Array.isArray(coords[pin]) ? (coords[pin] as [number, number]) : null);

export default async function PinsTab({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ t?: string }> }) {
  const { sessionId } = await params;
  const { t: focus } = await searchParams;
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
        id: t.id, city: t.city, state: t.state, tier: t.tier, priority: t.priority, openSlots: t.openSlots, realCapacity: sum?.realCapacity ?? 0,
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
            pin, coord: at(pin), state: elsewhere ? "elsewhere" : store ? "store" : holder ? "taken" : "free", label: elsewhere ? `in ${ownedBy}` : store ? store.id : holder ? holder.applicationId : "free", why,
            contested: appliedHere.length > 1, alsoIn: other,
            applicants: appliedHere.map((d) => ({ id: d.applicationId, name: d.name, status: d.status, cls: STATUS_CLASS[d.status], score: d.score?.total ?? null, reason: d.reasons[0] ? render(d.reasons[0]) : "" })),
          };
        }),
        candidates: snap.decisions.filter((d) => !d.assignedPin && s.applications.find((a) => a.id === d.applicationId)?.city.toLowerCase() === t.city.toLowerCase())
          .map((d) => ({ id: d.applicationId, label: `${d.applicationId} ${d.name} (${d.status}, ${d.score?.total ?? "–"})` })),
      };
    });

  const inTerritories = new Set(s.territories.flatMap((t) => t.pins));
  const outside: OutsideMarker[] = s.applications.filter((a) => !inTerritories.has(a.pin)).map((a) => {
    const d = byId.get(a.id);
    return { id: a.id, name: a.name, city: a.city, pin: a.pin, coord: at(a.pin), status: d?.status ?? "", cls: d ? STATUS_CLASS[d.status] : "", reason: d?.reasons[0] ? render(d.reasons[0]) : "" };
  });
  const storeMarkers = s.stores.filter((st) => !inTerritories.has(st.pin)).map((st) => ({ id: st.id, city: st.city, pin: st.pin, coord: at(st.pin) }));
  return <MapView sessionId={sessionId} territories={cards} outside={outside} stores={storeMarkers} focus={focus ?? null} />;
}
