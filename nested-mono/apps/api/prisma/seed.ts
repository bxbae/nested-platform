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
  "Mangwon River Studios": [
    "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=1200&q=80",
    "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200&q=80",
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=80",
    "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=1200&q=80",
  ],
  "Pangyo Valley House": [
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200&q=80",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80",
  ],
  "Ttukseom Sunrise": [
    "https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=1200&q=80",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
    "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80",
    "https://images.unsplash.com/photo-1617104678098-de229db51175?w=1200&q=80",
  ],
  "Hongdae Maker House": [
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80",
    "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1200&q=80",
    "https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?w=1200&q=80",
    "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=1200&q=80",
  ],
  "Seocho Commuter House": [
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200&q=80",
    "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=1200&q=80",
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80",
    "https://images.unsplash.com/photo-1560448075-bb485b067938?w=1200&q=80",
  ],
  "Gangnam Loft 22": [
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80",
    "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200&q=80",
    "https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=1200&q=80",
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80",
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
  "Mangwon River Studios": ["wifi", "kitchen", "laundry", "aircon", "desk"],
  "Pangyo Valley House": ["wifi", "parking", "kitchen", "desk", "aircon", "laundry"],
  "Ttukseom Sunrise": ["wifi", "rooftop", "kitchen", "aircon", "laundry"],
  "Hongdae Maker House": ["wifi", "desk", "kitchen", "rooftop", "aircon"],
  "Seocho Commuter House": ["wifi", "parking", "laundry", "kitchen", "desk", "aircon"],
  "Gangnam Loft 22": ["wifi", "parking", "rooftop", "kitchen", "desk", "aircon", "laundry"],
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
  "Mangwon River Studios": [
    { rating: 5, body: "한강이 걸어서 5분이라 아침 러닝하기 최고예요. 방도 깔끔하고 채광이 좋습니다." },
    { rating: 4, body: "망원시장이 가까워서 장보기 편해요. 주말엔 조금 붐비지만 위치는 만점.", hostReply: "감사합니다! 편하게 지내세요 :)" },
    { rating: 5, body: "혼자 살기 딱 좋은 스튜디오예요. 옵션이 잘 갖춰져 있어 바로 입주했습니다." },
  ],
  "Pangyo Valley House": [
    { rating: 5, body: "판교 IT회사 다니는데 통근이 정말 편해요. 주차도 되고 조용합니다." },
    { rating: 4, body: "신축이라 깨끗하고 냉난방이 잘 돼요. 근처 편의시설이 조금 아쉽지만 만족." },
  ],
  "Ttukseom Sunrise": [
    { rating: 5, body: "뚝섬한강공원이 코앞이라 뷰가 정말 좋아요. 루프탑에서 보는 일출이 이름값 합니다.", hostReply: "일출 맛집이죠! 좋게 봐주셔서 감사해요." },
    { rating: 4, body: "성수·서울숲 접근성이 뛰어나요. 젊은 분들이 많아 활기찹니다." },
    { rating: 5, body: "인테리어가 감각적이고 공용 공간이 넓어요. 재계약했습니다." },
  ],
  "Hongdae Maker House": [
    { rating: 5, body: "홍대 한복판인데 방음이 의외로 잘 돼요. 작업실 겸 살기 좋습니다." },
    { rating: 4, body: "공용 주방이 넓고 루프탑이 매력적이에요. 밤에 조금 시끄러울 때가 있어요." },
  ],
  "Seocho Commuter House": [
    { rating: 5, body: "강남·교대 통근이 편하고 주차가 되는 게 최고예요. 조용하고 깔끔합니다.", hostReply: "감사합니다! 오래 지내주세요." },
    { rating: 5, body: "보안이 잘 돼 있고 관리가 꼼꼼해요. 여성 혼자 살기에도 안심됩니다." },
  ],
  "Gangnam Loft 22": [
    { rating: 5, body: "역삼역 도보 5분, 회사 통근이 정말 편해요. 복층이라 공간 활용도 좋습니다.", hostReply: "좋게 봐주셔서 감사합니다!" },
    { rating: 4, body: "루프탑 뷰가 멋져요. 월세가 조금 높지만 위치와 시설을 생각하면 납득됩니다." },
    { rating: 5, body: "신축이라 깔끔하고 방음도 훌륭해요. 재택·출근 둘 다 만족스럽습니다." },
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
    { name: "Mangwon River Studios", region: "Mangwon-dong", lat: 37.5556, lng: 126.9018, monthlyRent: 720000 },
    { name: "Pangyo Valley House", region: "Pangyo", lat: 37.3948, lng: 127.1112, monthlyRent: 850000 },
    { name: "Ttukseom Sunrise", region: "Seongsu-dong", lat: 37.5470, lng: 127.0660, monthlyRent: 810000 },
    { name: "Hongdae Maker House", region: "Seogyo-dong", lat: 37.5561, lng: 126.9236, monthlyRent: 700000 },
    { name: "Seocho Commuter House", region: "Seocho-dong", lat: 37.4837, lng: 127.0324, monthlyRent: 830000 },
    { name: "Gangnam Loft 22", region: "Yeoksam-dong", lat: 37.5006, lng: 127.0364, monthlyRent: 920000 },
  ];

  for (const r of rooms) {
    // Idempotent: clear any prior room with the same name first.
    // Idempotent: clear a prior room with the same name, removing its
    // dependent rows first so foreign-key RESTRICT constraints don't block it.
    const existing = await prisma.room.findMany({
      where: { name: r.name },
      select: { id: true },
    });
    const existingIds = existing.map((e) => e.id);
    if (existingIds.length > 0) {
      await prisma.review.deleteMany({ where: { roomId: { in: existingIds } } });
      await prisma.image.deleteMany({ where: { roomId: { in: existingIds } } });
      await prisma.roomAmenity.deleteMany({ where: { roomId: { in: existingIds } } });
      await prisma.room.deleteMany({ where: { id: { in: existingIds } } });
    }

    const photos = PHOTOS[r.name] ?? [];
    const amenityKeys = ROOM_AMENITIES[r.name] ?? [];

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
        // Reviews are no longer seeded: ratings must come from real reviews
        // posted through the app (POST /reviews). A freshly seeded room shows
        // ★0 · 후기 0개 until guests review it. (See REVIEWS below — kept only
        // as sample copy for demos, intentionally unused.)
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

  // ── Community board ──────────────────────────────────────────────
  // A few posts (with replies) so the feed isn't empty on a fresh database.
  const firstRoom = await prisma.room.findFirst({ orderBy: { createdAt: "asc" } });
  if (firstRoom) {
    await prisma.post.deleteMany({});

    const notice = await prisma.post.create({
      data: {
        roomId: firstRoom.id,
        authorId: host.id,
        category: "NOTICE",
        title: "이번 주 토요일 정기 점검 안내",
        body: "오전 10시부터 12시까지 보일러 점검이 있습니다. 잠시 온수 사용이 어려울 수 있어요.",
        pinned: true,
      },
    });
    await prisma.comment.createMany({
      data: [
        { postId: notice.id, authorId: guest.id, body: "알려주셔서 감사합니다! 그 시간엔 외출할게요." },
        { postId: notice.id, authorId: host.id, body: "네, 점검 끝나면 다시 공지드리겠습니다." },
      ],
    });

    const market = await prisma.post.create({
      data: {
        roomId: firstRoom.id,
        authorId: guest.id,
        category: "MARKET",
        title: "책상 나눔합니다 (무료)",
        body: "이사하면서 책상을 나눔합니다. 상태 좋아요. 관심 있으신 분 댓글 남겨주세요.",
      },
    });
    await prisma.comment.create({
      data: { postId: market.id, authorId: host.id, body: "혹시 아직 남아있나요?" },
    });

    await prisma.post.create({
      data: {
        roomId: firstRoom.id,
        authorId: guest.id,
        category: "CHAT",
        title: "근처 괜찮은 카페 추천받아요",
        body: "재택근무할 만한 조용한 카페 있을까요? 노트북 작업하기 좋은 곳이면 좋겠어요.",
      },
    });
  }

  console.log(`Seed complete: 1 host, 1 guest, ${rooms.length} rooms (with photos/amenities, no seeded reviews), 1 coupon, 3 posts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
