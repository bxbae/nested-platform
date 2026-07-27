import { NextRequest, NextResponse } from "next/server";
import { houses } from "@/lib/data";
import type {
  BuildingType,
  GenderPolicy,
  House,
  PaginatedRooms,
  RentalUnit,
  RoomType,
  SharedFacility,
  SortKey,
} from "@/lib/types";
import { districtForRegion } from "@/lib/seoul";

// GET /api/search — cursor-paginated, filtered room search.
// Mirrors the /search contract in ARCHITECTURE.md §7.2.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;

  const q = (p.get("q") ?? "").toLowerCase().trim();
  const region = p.get("region") ?? "";
  const district = p.get("district") ?? "";
  const roomTypes = (p.get("roomTypes") ?? "")
    .split(",")
    .filter(Boolean) as RoomType[];
  const rentalUnits = (p.get("rentalUnits") ?? "")
    .split(",")
    .filter(Boolean) as RentalUnit[];
  const buildingTypes = (p.get("buildingTypes") ?? "")
    .split(",")
    .filter(Boolean) as BuildingType[];
  const sharedFacilities = (p.get("sharedFacilities") ?? "")
    .split(",")
    .filter(Boolean) as SharedFacility[];
  const minRent = p.get("minRent") ? Number(p.get("minRent")) : null;
  const maxRent = p.get("maxRent") ? Number(p.get("maxRent")) : null;
  const availableFrom = p.get("availableFrom"); // ISO date
  const gender = (p.get("gender") ?? "") as GenderPolicy | "";
  const pets = p.get("pets") === "true";
  const smoking = p.get("smoking") === "true";
  const parking = p.get("parking") === "true";
  const sort = (p.get("sort") ?? "recommended") as SortKey;
  const cursor = p.get("cursor");
  const limit = Math.min(24, Math.max(4, Number(p.get("limit") ?? 12)));

  // ── filter ──
  const result: House[] = houses.filter((h) => {
    if (q && !`${h.name} ${h.neighborhood} ${h.region} ${h.blurb}`.toLowerCase().includes(q))
      return false;
    if (region && h.region !== region) return false;
    if (district && districtForRegion(h.region) !== district) return false;
    if (roomTypes.length && !roomTypes.includes(h.roomType)) return false;
    if (rentalUnits.length) {
      const safeLegacyWhole = !h.rentalUnit && h.roomType === "whole_house";
      if (!h.rentalUnit && !(safeLegacyWhole && rentalUnits.includes("whole"))) return false;
      if (h.rentalUnit && !rentalUnits.includes(h.rentalUnit)) return false;
    }
    if (buildingTypes.length) {
      const legacyBuilding =
        h.roomType === "one_room"
          ? "studio"
          : h.roomType === "apartment"
            ? "apartment"
            : h.roomType === "whole_house"
              ? "house"
              : null;
      const building = h.buildingType ?? legacyBuilding;
      if (!building || !buildingTypes.includes(building)) return false;
    }
    if (
      sharedFacilities.length &&
      !sharedFacilities.every((facility) => h.sharedFacilities?.includes(facility))
    ) return false;
    if (minRent != null && h.monthlyRent < minRent) return false;
    if (maxRent != null && h.monthlyRent > maxRent) return false;
    if (availableFrom && h.availableFrom > availableFrom) return false;
    if (gender && gender !== "any" && h.genderPolicy !== "any" && h.genderPolicy !== gender)
      return false;
    if (pets && !h.petsAllowed) return false;
    if (smoking && !h.smokingAllowed) return false;
    if (parking && !h.parking) return false;
    return true;
  });

  // ── sort ──
  const sorters: Record<SortKey, (a: House, b: House) => number> = {
    recommended: (a, b) => b.rating * b.reviews - a.rating * a.reviews,
    price_asc: (a, b) => a.monthlyRent - b.monthlyRent,
    price_desc: (a, b) => b.monthlyRent - a.monthlyRent,
    rating: (a, b) => b.rating - a.rating,
    newest: (a, b) => a.availableFrom.localeCompare(b.availableFrom),
  };
  result.sort(sorters[sort] ?? sorters.recommended);

  const total = result.length;

  // ── cursor pagination (stable id-based) ──
  let startIndex = 0;
  if (cursor) {
    const idx = result.findIndex((h) => h.id === cursor);
    startIndex = idx >= 0 ? idx + 1 : 0;
  }
  const page = result.slice(startIndex, startIndex + limit);
  const nextCursor =
    startIndex + limit < total ? page[page.length - 1]?.id ?? null : null;

  const body: PaginatedRooms = { items: page, nextCursor, total };

  // simulate a little latency so skeletons are visible in the demo
  await new Promise((r) => setTimeout(r, 220));

  return NextResponse.json(body);
}
