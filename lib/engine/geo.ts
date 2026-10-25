import pins from "@/config/pins.json";
import type { Pin, Store } from "@/lib/types";

const coords = pins as unknown as Record<string, [number, number]>;

export function km(a: Pin, b: Pin): number | null {
  const p = coords[a], q = coords[b];
  if (!Array.isArray(p) || !Array.isArray(q)) return null;
  const R = 6371, rad = Math.PI / 180;
  const dLat = (q[0] - p[0]) * rad, dLng = (q[1] - p[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p[0] * rad) * Math.cos(q[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distance to the nearest existing store, or null when the pin is not in the bundled table. */
export function nearestStore(pin: Pin, stores: Store[]): { km: number; storeId: string } | null {
  let best: { km: number; storeId: string } | null = null;
  for (const s of stores) {
    const d = s.pin === pin ? 0 : km(pin, s.pin);
    if (d !== null && (!best || d < best.km)) best = { km: d, storeId: s.id };
  }
  return best;
}
