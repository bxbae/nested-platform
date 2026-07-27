export type ServiceArea = "서울" | "경기" | "인천";

export const AREA_OPTIONS: readonly ServiceArea[] = [
  "서울",
  "경기",
  "인천",
];

export interface ServiceDistrictOption {
  area: ServiceArea;
  city: string;
  label: string;
  value: string;
  aliases: readonly string[];
}

export const DISTRICTS_BY_AREA: Record<
  ServiceArea,
  readonly ServiceDistrictOption[]
> = {
  서울: [
    { area: "서울", city: "서울", label: "강남구", value: "강남구", aliases: ["Gangnam-gu", "Yeoksam-dong", "역삼동"] },
    { area: "서울", city: "서울", label: "서초구", value: "서초구", aliases: ["Seocho-gu"] },
    { area: "서울", city: "서울", label: "송파구", value: "송파구", aliases: ["Songpa-gu"] },
    { area: "서울", city: "서울", label: "마포구", value: "마포구", aliases: ["Mapo-gu", "Mangwon-dong", "Seogyo-dong", "Yeonnam-dong", "Hongdae"] },
    { area: "서울", city: "서울", label: "성동구", value: "성동구", aliases: ["Seongdong-gu", "Seongsu-dong"] },
    { area: "서울", city: "서울", label: "용산구", value: "용산구", aliases: ["Yongsan-gu", "Itaewon"] },
    { area: "서울", city: "서울", label: "영등포구", value: "영등포구", aliases: ["Yeongdeungpo-gu", "Yeouido"] },
    { area: "서울", city: "서울", label: "종로구", value: "종로구", aliases: ["Jongno-gu", "Hyehwa-dong"] },
    { area: "서울", city: "서울", label: "관악구", value: "관악구", aliases: ["Gwanak-gu", "Sillim", "Bongcheon-dong"] },
    { area: "서울", city: "서울", label: "구로구", value: "구로구", aliases: ["Guro-gu", "Gasan-dong"] },
    { area: "서울", city: "서울", label: "강서구", value: "강서구", aliases: ["Gangseo-gu", "Magok-dong"] },
  ],
  경기: [
    { area: "경기", city: "경기", label: "판교·분당", value: "분당구", aliases: ["Bundang-gu", "Pangyo", "판교", "분당"] },
    { area: "경기", city: "경기", label: "수원·광교", value: "영통구", aliases: ["영통구", "광교동", "수원", "광교"] },
    { area: "경기", city: "경기", label: "용인·수지", value: "수지구", aliases: ["수지구", "용인", "수지"] },
    { area: "경기", city: "경기", label: "고양·일산", value: "일산동구", aliases: ["일산동구", "일산", "고양"] },
    { area: "경기", city: "경기", label: "광명", value: "광명시", aliases: ["광명시", "광명"] },
    { area: "경기", city: "경기", label: "안양", value: "동안구", aliases: ["동안구", "안양"] },
    { area: "경기", city: "경기", label: "하남", value: "하남시", aliases: ["하남시", "하남"] },
    { area: "경기", city: "경기", label: "부천", value: "부천시", aliases: ["부천시", "부천"] },
  ],
  인천: [
    { area: "인천", city: "인천", label: "송도·연수", value: "연수구", aliases: ["연수구", "송도동", "송도"] },
    { area: "인천", city: "인천", label: "부평구", value: "부평구", aliases: ["부평구", "부평"] },
    { area: "인천", city: "인천", label: "남동구", value: "남동구", aliases: ["남동구", "구월동"] },
    { area: "인천", city: "인천", label: "계양구", value: "계양구", aliases: ["계양구"] },
    { area: "인천", city: "인천", label: "미추홀구", value: "미추홀구", aliases: ["미추홀구"] },
    { area: "인천", city: "인천", label: "서구·청라", value: "서구", aliases: ["인천 서구", "청라동", "청라"] },
  ],
};

export const DISTRICT_OPTIONS: readonly ServiceDistrictOption[] = [
  ...DISTRICTS_BY_AREA.서울,
  ...DISTRICTS_BY_AREA.경기,
  ...DISTRICTS_BY_AREA.인천,
];

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
  { area: "서울", label: "강남·역삼", query: "역삼", district: "강남구", region: "" },
  { area: "서울", label: "여의도", query: "여의도", district: "영등포구", region: "" },
  { area: "경기", label: "판교·분당", query: "판교", district: "분당구", region: "" },
  { area: "서울", label: "광화문·종로", query: "광화문", district: "종로구", region: "" },
  { area: "서울", label: "구로·가산", query: "가산", district: "구로구", region: "" },
  { area: "서울", label: "성수", query: "성수", district: "성동구", region: "" },
  { area: "서울", label: "마곡", query: "마곡", district: "강서구", region: "" },
  { area: "인천", label: "송도", query: "송도", district: "연수구", region: "" },
] as const;
