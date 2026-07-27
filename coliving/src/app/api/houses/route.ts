import { NextRequest, NextResponse } from "next/server";
import { jobHubs, estimateCommute } from "@/lib/commute";
import type {
  BuildingType,
  House,
  RentalUnit,
  SharedFacility,
} from "@/lib/types";
import { loadHouses } from "@/lib/houses-source";

interface HouseWithCommute extends House {
  commute?: {
    minutes: number;
    km: number;
    mode: string;
    hubId: string;
  };
}

function csv<T extends string>(value: string | null): T[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as T[];
}

function rentalUnitOf(house: House): RentalUnit {
  if (house.rentalUnit) return house.rentalUnit;
  if (house.roomType === "share_room") return "bed";
  if (house.roomType === "one_room") return "private_room";
  return "whole";
}

function buildingTypeOf(house: House): BuildingType {
  if (house.buildingType) return house.buildingType;
  if (house.roomType === "apartment") return "apartment";
  if (house.roomType === "whole_house") return "house";
  return "studio";
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;

  // 단일 숙소 조회 (상세페이지용) — id가 있으면 목록 대신 하나만 반환한다.
  const id = p.get("id");
  if (id) {
    const houses = await loadHouses();
    const house = houses.find((h) => h.id === id);
    if (!house) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(house);
  }

  const q = (p.get("q") ?? "").toLowerCase().trim();
  const rentalUnits = csv<RentalUnit>(p.get("rentalUnits"));
  const buildingTypes = csv<BuildingType>(p.get("buildingTypes"));
  const sharedFacilities = csv<SharedFacility>(
    p.get("sharedFacilities"),
  );
  const vibes = csv<string>(p.get("vibes"));
  const maxRent = p.get("maxRent")
    ? Number(p.get("maxRent"))
    : null;
  const maxCommute = p.get("maxCommute")
    ? Number(p.get("maxCommute"))
    : null;
  const hubId = p.get("hub");
  const sort = p.get("sort") ?? "commute";

  const hub = hubId
    ? jobHubs.find((item) => item.id === hubId)
    : null;

  const houses = await loadHouses();

  let result: HouseWithCommute[] = houses.map((house) => {
    if (!hub) return { ...house };

    const commute = estimateCommute(
      house.lat,
      house.lng,
      hub.lat,
      hub.lng,
    );

    return {
      ...house,
      commute: {
        ...commute,
        hubId: hub.id,
      },
    };
  });

  result = result.filter((house) => {
    const searchText = [
      house.name,
      house.neighborhood,
      house.city,
      house.region,
      house.blurb,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (q && !searchText.includes(q)) return false;

    if (
      rentalUnits.length > 0 &&
      !rentalUnits.includes(rentalUnitOf(house))
    ) {
      return false;
    }

    if (
      buildingTypes.length > 0 &&
      !buildingTypes.includes(buildingTypeOf(house))
    ) {
      return false;
    }

    if (
      sharedFacilities.length > 0 &&
      !sharedFacilities.every((facility) =>
        (house.sharedFacilities ?? []).includes(facility),
      )
    ) {
      return false;
    }

    if (
      vibes.length > 0 &&
      !vibes.some((vibe) => house.vibe.includes(vibe))
    ) {
      return false;
    }

    if (maxRent != null && house.monthlyRent > maxRent) {
      return false;
    }

    if (
      maxCommute != null &&
      house.commute &&
      house.commute.minutes > maxCommute
    ) {
      return false;
    }

    return true;
  });

  if (sort === "commute" && hub) {
    result.sort(
      (a, b) =>
        (a.commute?.minutes ?? 999) -
        (b.commute?.minutes ?? 999),
    );
  } else if (sort === "price-asc") {
    result.sort((a, b) => a.monthlyRent - b.monthlyRent);
  } else if (sort === "price-desc") {
    result.sort((a, b) => b.monthlyRent - a.monthlyRent);
  } else if (sort === "rating") {
    result.sort((a, b) => b.rating - a.rating);
  } else if (hub) {
    result.sort(
      (a, b) =>
        (a.commute?.minutes ?? 999) -
        (b.commute?.minutes ?? 999),
    );
  }

  return NextResponse.json({
    houses: result,
    hub,
  });
}
