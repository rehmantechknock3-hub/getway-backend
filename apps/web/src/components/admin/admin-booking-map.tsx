"use client";

import { useEffect, useRef } from "react";

import L from "leaflet";

import "leaflet/dist/leaflet.css";

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type AdminBookingMapProps = {
  latitude: number | null;
  longitude: number | null;
  defaultCenter: { lat: number; lng: number };
  onPick: (coords: { latitude: number; longitude: number }) => void;
};

/**
 * Imperative Leaflet map — avoids react-leaflet MapContainer + React Strict Mode
 * "Map container is already initialized" races.
 */
export function AdminBookingMap({
  latitude,
  longitude,
  defaultCenter,
  onPick,
}: AdminBookingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Create / destroy map once for this DOM node.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      scrollWheelZoom: true,
    }).setView(
      [defaultCenter.lat, defaultCenter.lng],
      12,
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    map.on("click", (event: L.LeafletMouseEvent) => {
      onPickRef.current({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    });

    mapRef.current = map;

    // Leaflet needs a tick after layout to size correctly in flex containers.
    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 50);

    return () => {
      window.clearTimeout(resizeTimer);
      map.off();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      // Strict Mode remounts the same DOM node; clear Leaflet's internal mark.
      const marked = el as HTMLElement & { _leaflet_id?: number | null };
      marked._leaflet_id = null;
    };
    // defaultCenter is stable from parent; do not re-init on pin changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker + view when coordinates change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (latitude == null || longitude == null) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }

    const latLng: L.LatLngExpression = [latitude, longitude];

    if (!markerRef.current) {
      markerRef.current = L.marker(latLng, { icon: markerIcon }).addTo(map);
    } else {
      markerRef.current.setLatLng(latLng);
    }

    map.setView(latLng, Math.max(map.getZoom(), 15), { animate: true });
    map.invalidateSize();
  }, [latitude, longitude]);

  return <div ref={containerRef} className="h-full w-full" />;
}
