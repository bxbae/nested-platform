export const DISTRICT_OPTIONS = [
  {
    label: "강남구",
    value: "강남구",
    aliases: ["Gangnam-gu", "Yeoksam-dong"],
  },
  {
    label: "서초구",
    value: "서초구",
    aliases: ["Seocho-gu"],
  },
  {
    label: "송파구",
    value: "송파구",
    aliases: ["Songpa-gu"],
  },
  {
    label: "마포구",
    value: "마포구",
    aliases: [
      "Mapo-gu",
      "Mangwon-dong",
      "Seogyo-dong",
      "Yeonnam-dong",
      "Hongdae",
    ],
  },
  {
    label: "성동구",
    value: "성동구",
    aliases: ["Seongdong-gu", "Seongsu-dong"],
  },
  {
    label: "용산구",
    value: "용산구",
    aliases: ["Yongsan-gu", "Itaewon"],
  },
  {
    label: "영등포구",
    value: "영등포구",
    aliases: ["Yeongdeungpo-gu", "Yeouido"],
  },
  {
    label: "종로구",
    value: "종로구",
    aliases: ["Jongno-gu", "Hyehwa-dong"],
  },
  {
    label: "관악구",
    value: "관악구",
    aliases: ["Gwanak-gu", "Sillim", "Bongcheon-dong"],
  },
  {
    label: "구로구",
    value: "구로구",
    aliases: ["Guro-gu", "Gasan-dong"],
  },
  {
    label: "분당구",
    value: "분당구",
    aliases: ["Bundang-gu", "Pangyo"],
  },
] as const;

export const NEIGHBORHOOD_OPTIONS = {
  강남구: [{ label: "역삼동", value: "Yeoksam-dong" }],
  서초구: [],
  송파구: [],
  마포구: [
    { label: "망원동", value: "Mangwon-dong" },
    { label: "서교동", value: "Seogyo-dong" },
    { label: "연남동", value: "Yeonnam-dong" },
    { label: "홍대", value: "Hongdae" },
  ],
  성동구: [{ label: "성수동", value: "Seongsu-dong" }],
  용산구: [{ label: "이태원", value: "Itaewon" }],
  영등포구: [{ label: "여의도", value: "Yeouido" }],
  종로구: [{ label: "혜화동", value: "Hyehwa-dong" }],
  관악구: [
    { label: "신림동", value: "Sillim" },
    { label: "봉천동", value: "Bongcheon-dong" },
  ],
  구로구: [{ label: "가산동", value: "Gasan-dong" }],
  분당구: [{ label: "판교", value: "Pangyo" }],
} as const;

const REGION_LABELS: Record<string, string> = {
  "Gangnam-gu": "강남구",
  "Yeoksam-dong": "역삼동",

  "Seocho-gu": "서초구",

  "Songpa-gu": "송파구",

  "Mapo-gu": "마포구",
  "Mangwon-dong": "망원동",
  "Seogyo-dong": "서교동",
  "Yeonnam-dong": "연남동",
  Hongdae: "홍대",

  "Seongdong-gu": "성동구",
  "Seongsu-dong": "성수동",

  "Yongsan-gu": "용산구",
  Itaewon: "이태원",

  "Yeongdeungpo-gu": "영등포구",
  Yeouido: "여의도",

  "Jongno-gu": "종로구",
  "Hyehwa-dong": "혜화동",

  "Gwanak-gu": "관악구",
  Sillim: "신림동",
  "Bongcheon-dong": "봉천동",

  "Guro-gu": "구로구",
  "Gasan-dong": "가산동",

  "Bundang-gu": "분당구",
  Pangyo: "판교",
};

export function regionLabel(region: string): string {
  return REGION_LABELS[region] ?? region;
}

export function districtForRegion(region: string): string {
  return (
    DISTRICT_OPTIONS.find((item) =>
      (item.aliases as readonly string[]).includes(region),
    )?.label ?? regionLabel(region)
  );
}

export function districtAliases(district: string): string[] {
  return [
    ...(DISTRICT_OPTIONS.find((item) => item.value === district)?.aliases ??
      []),
  ];
}

export const WORKPLACE_PRESETS = [
  {
    label: "강남·역삼",
    query: "강남·역삼",
    district: "강남구",
    region: "Yeoksam-dong",
  },
  {
    label: "여의도",
    query: "여의도",
    district: "영등포구",
    region: "Yeouido",
  },
  {
    label: "판교",
    query: "판교",
    district: "분당구",
    region: "Pangyo",
  },
  {
    label: "광화문·종로",
    query: "광화문·종로",
    district: "종로구",
    region: "Jongno-gu",
  },
  {
    label: "구로·가산",
    query: "구로·가산",
    district: "구로구",
    region: "Gasan-dong",
  },
  {
    label: "성수",
    query: "성수",
    district: "성동구",
    region: "Seongsu-dong",
  },
] as const;
