import type { House } from "./types";

// Deterministic enrichment so every listing has a full detail page
// (host, gallery, reviews) without hand-authoring 36 records. Values are
// seeded from the house id so they're stable across renders.

const HOST_NAMES = ["김하늘", "이서준", "박지우", "최민서", "정예은", "강도윤", "윤하은", "임시우"];
const REVIEW_AUTHORS = ["민지", "준호", "서연", "현우", "지훈", "예린", "도현", "수아", "하준", "채원"];
const AVATAR_COLORS = ["#FF7A5C", "#00A699", "#3E9BC4", "#7C6FE0", "#FFB400", "#4A8FD6", "#2FB39C", "#E8654F"];

const GALLERY_POOL = [
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=800&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?w=800&q=80&auto=format&fit=crop",
];

const REVIEW_BODIES = [
  "위치가 정말 좋고 하우스메이트들도 친절했어요. 다음에도 또 살고 싶은 집이에요.",
  "방음이 잘 되어 있어서 재택근무하기 편했습니다. 공용 공간도 깔끔했어요.",
  "호스트님이 문의에 빠르게 답변해주셔서 입주 과정이 수월했어요.",
  "주변에 카페와 편의시설이 많아서 생활이 편리했습니다. 강력 추천해요.",
  "채광이 좋고 환기가 잘 돼요. 커뮤니티 분위기도 따뜻합니다.",
  "교통이 편해서 출퇴근이 정말 편했어요. 청소도 주기적으로 해주셔서 좋았습니다.",
];

// simple stable hash from id
function seed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return h;
}

export function enrichHouse(house: House): Required<Pick<House, "gallery" | "host" | "houseReviews" | "description">> & House {
  const s = seed(house.id);

  const gallery = [
    house.photo ?? GALLERY_POOL[s % GALLERY_POOL.length],
    GALLERY_POOL[(s + 1) % GALLERY_POOL.length],
    GALLERY_POOL[(s + 3) % GALLERY_POOL.length],
    GALLERY_POOL[(s + 5) % GALLERY_POOL.length],
    GALLERY_POOL[(s + 6) % GALLERY_POOL.length],
  ];

  const host = house.host ?? {
    name: HOST_NAMES[s % HOST_NAMES.length],
    since: String(2021 + (s % 4)),
    superhost: house.rating >= 4.7,
    responseRate: 92 + (s % 8),
    avatarColor: AVATAR_COLORS[s % AVATAR_COLORS.length],
  };

  const reviewCount = 3 + (s % 3);
  const houseReviews =
    house.houseReviews ??
    Array.from({ length: reviewCount }).map((_, i) => {
      const k = (s + i * 7) % REVIEW_AUTHORS.length;
      const month = 1 + ((s + i * 3) % 6);
      return {
        author: REVIEW_AUTHORS[k],
        rating: 4 + ((s + i) % 2), // 4 or 5
        date: `2026.${String(month).padStart(2, "0")}`,
        body: REVIEW_BODIES[(s + i * 5) % REVIEW_BODIES.length],
        avatarColor: AVATAR_COLORS[(k + 2) % AVATAR_COLORS.length],
      };
    });

  const description =
    house.description ??
    `${house.region}에 위치한 ${house.name.trim()}입니다. ${house.blurb} ` +
      `총 ${house.bedrooms}개의 침실에 현재 ${house.residents}명이 함께 생활하고 있으며, ` +
      `최소 ${house.minStayMonths}개월부터 월 단위로 계약할 수 있습니다. ` +
      `도심 속에서 편안한 휴식과 새로운 인연을 함께 누려보세요.`;

  return { ...house, gallery, host, houseReviews, description };
}
