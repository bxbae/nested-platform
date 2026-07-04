import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

// Seeds a host, a guest, and a couple of published rooms so the API has
// data to serve immediately after `npx prisma migrate dev`.
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const host = await prisma.user.upsert({
    where: { email: "host@nested.kr" },
    update: {},
    create: { email: "host@nested.kr", name: "이서준", role: "HOST", passwordHash },
  });

  await prisma.user.upsert({
    where: { email: "guest@nested.kr" },
    update: {},
    create: { email: "guest@nested.kr", name: "김하늘", role: "GUEST", passwordHash },
  });

  const rooms = [
    { name: "Seongsu Loom", region: "Seongsu-dong", lat: 37.5446, lng: 127.0559, monthlyRent: 780000 },
    { name: "Yeonnam Quiet House", region: "Yeonnam-dong", lat: 37.5636, lng: 126.9256, monthlyRent: 690000 },
  ];

  for (const r of rooms) {
    await prisma.room.create({
      data: {
        hostId: host.id,
        name: r.name,
        region: r.region,
        lat: r.lat,
        lng: r.lng,
        roomType: "SHARE_ROOM",
        monthlyRent: r.monthlyRent,
        deposit: r.monthlyRent * 4,
        cleaningFee: 80000,
        maintenanceFee: 50000,
        minStayMonths: 3,
        availableFrom: new Date("2026-08-01"),
        published: true,
      },
    });
  }

  await prisma.coupon.upsert({
    where: { code: "WELCOME5" },
    update: {},
    create: {
      code: "WELCOME5",
      type: "PERCENT",
      value: 5,
      minSpend: 0,
      validFrom: new Date("2026-01-01"),
      validTo: new Date("2026-12-31"),
      usageLimit: 1000,
    },
  });

  console.log("Seed complete: 1 host, 1 guest, 2 rooms, 1 coupon.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
