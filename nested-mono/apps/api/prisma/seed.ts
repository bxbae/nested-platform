import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

// Seeds a host, a guest, and a couple of published rooms — now with photos,
// amenities, and reviews so detail pages render fully after seeding.
const prisma = new PrismaClient();

// Stable Unsplash photo URLs (interior / co-living vibes).
const PHOTOS: Record<string, string[]> = {
  "Seongsu Loom": [
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80",
  ],
  "Yeonnam Quiet House": [
    "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=1200&q=80",
    "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=1200&q=80",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80",
    "https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?w=1200&q=80",
  ],
};

// Amenities catalog (key is unique). label is what the UI shows.
const AMENITIES = [
  { key: "wifi", label: "고속 Wi-Fi", icon: "wifi" },
  { key: "laundry", label: "공용 세탁실", icon: "washer" },
  { key: "kitchen", label: "공용 주방", icon: "kitchen" },
  { key: "rooftop", label: "루프탑 라운지", icon: "sun" },
  { key: "parking", label: "주차 가능", icon: "car" },
  { key: "desk", label: "업무용 책상", icon: "desk" },
  { key: "aircon", label: "냉난방", icon: "thermometer" },
];

const ROOM_AMENITIES: Record<string, string[]> = {
  "Seongsu Loom": ["wifi", "laundry", "kitchen", "rooftop", "desk", "aircon"],
  "Yeonnam Quiet House": ["wifi", "laundry", "kitchen", "desk", "aircon", "parking"],
};

const REVIEWS: Record<string, { rating: number; body: string; hostReply?: string }[]> = {
  "Seongsu Loom": [
    { rating: 5, body: "성수동 한복판인데 방음이 잘 돼서 조용했어요. 루프탑에서 노을 보는 게 최고였습니다.", hostReply: "좋게 봐주셔서 감사해요! 다음에도 편하게 오세요 :)" },
    { rating: 4, body: "위치가 정말 좋고 카페·작업실 접근성이 뛰어나요. 주방이 조금 붐빌 때가 있지만 전반적으로 만족." },
    { rating: 5, body: "인테리어 감성이 사진 그대로예요. 재택근무하기 딱 좋은 책상과 의자." },
  ],
  "Yeonnam Quiet House": [
    { rating: 5, body: "이름처럼 정말 조용해요. 연남동 숲길 산책하기 좋고 룸메이트분들도 친절했습니다." },
    { rating: 4, body: "가성비가 훌륭합니다. 주차까지 되는 게 큰 장점이에요.", hostReply: "이용해 주셔서 감사합니다!" },
  ],
};

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const host = await prisma.user.upsert({
    where: { email: "host@nested.kr" },
    update: {},
    create: { email: "host@nested.kr", name: "이서준", role: "HOST", passwordHash },
  });

  const guest = await prisma.user.upsert({
    where: { email: "guest@nested.kr" },
    update: {},
    create: { email: "guest@nested.kr", name: "김하늘", role: "GUEST", passwordHash },
  });

  // Amenities catalog — upsert by unique key.
  const amenityByKey: Record<string, string> = {};
  for (const a of AMENITIES) {
    const rec = await prisma.amenity.upsert({
      where: { key: a.key },
      update: { label: a.label, icon: a.icon },
      create: a,
    });
    amenityByKey[a.key] = rec.id;
  }

  const rooms = [
    { name: "Seongsu Loom", region: "Seongsu-dong", lat: 37.5446, lng: 127.0559, monthlyRent: 780000 },
    { name: "Yeonnam Quiet House", region: "Yeonnam-dong", lat: 37.5636, lng: 126.9256, monthlyRent: 690000 },
  ];

  for (const r of rooms) {
    // Idempotent: clear any prior room with the same name first.
    await prisma.room.deleteMany({ where: { name: r.name } });

    const photos = PHOTOS[r.name] ?? [];
    const amenityKeys = ROOM_AMENITIES[r.name] ?? [];
    const reviews = REVIEWS[r.name] ?? [];

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
        images: {
          create: photos.map((url, i) => ({ url, order: i })),
        },
        amenities: {
          create: amenityKeys.map((k) => ({
            amenity: { connect: { id: amenityByKey[k] } },
          })),
        },
        reviews: {
          create: reviews.map((rv) => ({
            authorId: guest.id,
            rating: rv.rating,
            body: rv.body,
            hostReply: rv.hostReply ?? null,
          })),
        },
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

  console.log("Seed complete: 1 host, 1 guest, 2 rooms (with photos/amenities/reviews), 1 coupon.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
