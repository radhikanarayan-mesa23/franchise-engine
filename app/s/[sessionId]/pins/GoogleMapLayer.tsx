/// <reference types="google.maps" />
"use client";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { glassesDataUrl, type PinKind } from "@/components/glassesIcon";

export interface GeoItem { id: string; lat: number; lng: number; kind: PinKind; title: string; contested: boolean; selected: boolean }
export interface GeoHalo { id: string; lat: number; lng: number; radiusM: number; label: string }

// Arctic Depths map styling (navy land, deep-blue water, cyan roads, quiet labels).
const STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#163f55" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#a6c6d6" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b2230" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2b7393" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#3a8fb0" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#0DB8D3" }, { lightness: -10 }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a2433" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#2a6b86" }] },
];

const LIGHT: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#eef6fa" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#35546b" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] }, { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#b9e3f0" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c6e4f2" }] },
];

let loader: Promise<void> | null = null;
function loadMaps(key: string) {
  if (typeof window !== "undefined" && (window as unknown as { google?: { maps?: unknown } }).google?.maps) return Promise.resolve();
  loader ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loader = null; reject(new Error("Google Maps failed to load")); };
    document.head.appendChild(s);
  });
  return loader;
}

/** Real Google map with glasses markers. Calls onFail so the caller can fall back to the drawn map. */
export default function GoogleMapLayer({ apiKey, items, halos, fitKey, onSelect, onClear, onFail }: {
  apiKey: string; items: GeoItem[]; halos: GeoHalo[]; fitKey: string; onSelect: (id: string) => void; onClear: () => void; onFail: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const layers = useRef<{ markers: google.maps.Marker[]; circles: google.maps.Circle[] }>({ markers: [], circles: [] });
  const [ready, setReady] = useState(false);
  const { resolvedTheme } = useTheme();
  useEffect(() => { map.current?.setOptions({ styles: resolvedTheme === "light" ? LIGHT : STYLES, backgroundColor: resolvedTheme === "light" ? "#eef6fa" : "#0b2230" }); }, [resolvedTheme, ready]);
  const handlers = useRef({ onSelect, onClear });
  handlers.current = { onSelect, onClear };

  useEffect(() => {
    let dead = false;
    // Google calls this when the key is rejected (invalid, wrong referrer, billing off).
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => onFail();
    loadMaps(apiKey).then(() => {
      if (dead || !el.current) return;
      const light = document.documentElement.dataset.theme === "light";
      map.current = new google.maps.Map(el.current, { center: { lat: 12.97, lng: 77.59 }, zoom: 12, styles: light ? LIGHT : STYLES, disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy", backgroundColor: light ? "#eef6fa" : "#0b2230" });
      map.current.addListener("click", () => handlers.current.onClear());
      setReady(true);
    }).catch(() => onFail());
    return () => { dead = true; };
  }, [apiKey, onFail]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    layers.current.markers.forEach((x) => x.setMap(null));
    layers.current.circles.forEach((x) => x.setMap(null));
    layers.current.circles = halos.map((h) => new google.maps.Circle({ map: m, center: { lat: h.lat, lng: h.lng }, radius: h.radiusM,
      strokeColor: "#0DB8D3", strokeOpacity: 0.55, strokeWeight: 1.2, fillColor: "#0DB8D3", fillOpacity: 0.05, clickable: false }));
    layers.current.markers = items.map((it) => {
      const size = it.selected ? new google.maps.Size(46, 46) : new google.maps.Size(36, 36);
      const mk = new google.maps.Marker({ map: m, position: { lat: it.lat, lng: it.lng }, title: it.title, zIndex: it.selected ? 1000 : it.kind === "taken" ? 500 : 100,
        icon: { url: glassesDataUrl(it.kind, it.selected, it.contested), scaledSize: size, anchor: new google.maps.Point(size.width / 2, size.height / 2) } });
      mk.addListener("click", () => handlers.current.onSelect(it.id));
      return mk;
    });
  }, [ready, items, halos]);

  // Fit to the city's pins whenever the city changes (not on every selection).
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !items.length) return;
    const b = new google.maps.LatLngBounds();
    items.forEach((i) => b.extend({ lat: i.lat, lng: i.lng }));
    m.fitBounds(b, 90);
    google.maps.event.addListenerOnce(m, "idle", () => { if ((m.getZoom() ?? 0) > 15) m.setZoom(15); });
  }, [ready, fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="gmap" />;
}
