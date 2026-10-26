import type { Pin, Proximity, Store } from "@/lib/types";
import { nearestStore } from "./geo";
import type { Policy } from "./policy";
import { round } from "./gates";

/** Qualitative cannibalisation check: nearest existing store and whether it is inside the flag radius. */
export function proximityFor(pin: Pin, stores: Store[], policy: Policy): Proximity | null {
  const near = nearestStore(pin, stores);
  if (!near) return null;
  return { storeId: near.storeId, km: round(near.km), near: near.km <= policy.proximity.flag_radius_km };
}
