import { NextRequest, NextResponse } from "next/server";
import { jobHubs, estimateCommute } from "@/lib/commute";
import type { House } from "@/lib/types";
import { loadHouses } from "@/lib/houses-source";

interface HouseWithCommute extends House {
  commute?: { minutes: number; km: number; mode: string; hubId: string };
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = (p.get("q") ?? "").toLowerCase().trim();
  const roomType = p.get("roomType");
  const vibe = p.get("vibe");
  const maxRent = p.get("maxRent") ? Number(p.get("maxRent")) : null;
  const maxCommute = p.get("maxCommute") ? Number(p.get("maxCommute")) : null;
  const hubId = p.get("hub");
  const sort = p.get("sort") ?? "recommended";

  const hub = hubId ? jobHubs.find((h) => h.id === hubId) : null;

  const houses = await loadHouses();

  let result: HouseWithCommute[] = houses.map((h) => {
    if (!hub) return { ...h };
    const c = estimateCommute(h.lat, h.lng, hub.lat, hub.lng);
    return { ...h, commute: { ...c, hubId: hub.id } };
  });

  result = result.filter((h) => {
    if (q && !`${h.name} ${h.neighborhood} ${h.city} ${h.blurb}`.toLowerCase().includes(q))
      return false;
    if (roomType && roomType !== "any" && h.roomType !== roomType) return false;
    if (vibe && vibe !== "any" && !h.vibe.includes(vibe)) return false;
    if (maxRent && h.monthlyRent > maxRent) return false;
    if (maxCommute && h.commute && h.commute.minutes > maxCommute) return false;
    return true;
  });

  if (sort === "commute" && hub) {
    result.sort((a, b) => (a.commute?.minutes ?? 999) - (b.commute?.minutes ?? 999));
  } else if (sort === "price-asc") {
    result.sort((a, b) => a.monthlyRent - b.monthlyRent);
  } else if (sort === "price-desc") {
    result.sort((a, b) => b.monthlyRent - a.monthlyRent);
  } else if (sort === "rating") {
    result.sort((a, b) => b.rating - a.rating);
  } else if (hub) {
    result.sort((a, b) => (a.commute?.minutes ?? 999) - (b.commute?.minutes ?? 999));
  }

  return NextResponse.json({ houses: result, hub });
}
