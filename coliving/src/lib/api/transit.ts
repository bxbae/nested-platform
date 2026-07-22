import { api } from "./client";

export interface TransitOption {
  mode: "subway" | "bus" | "subway_bus";
  minutes: number;
  transferCount?: number;
}
export interface TransitResult {
  walk: { mode: "walk"; minutes: number; km: number };
  car: { mode: "car"; minutes: number; km: number; estimated: boolean };
  transit: TransitOption[];
}

export async function getTransitRoutes(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<TransitResult> {
  return api.get<TransitResult>(
    `/transit?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}`,
    { auth: false }
  );
}