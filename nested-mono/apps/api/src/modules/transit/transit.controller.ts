import { Controller, Get, Query } from '@nestjs/common';
import { TransitService } from "./transit.service";

@Controller("transit")
export class TransitController {
  constructor(private transit: TransitService) {}

  @Get()
  getRoutes(
    @Query("fromLat") fromLat: string,
    @Query("fromLng") fromLng: string,
    @Query("toLat") toLat: string,
    @Query("toLng") toLng: string
  ) {
    return this.transit.getRoutes(Number(fromLat), Number(fromLng), Number(toLat), Number(toLng));
  }
}