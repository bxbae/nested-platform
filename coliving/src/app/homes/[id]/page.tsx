import { notFound } from "next/navigation";
import Link from "next/link";
import { houses } from "@/lib/data";
import { won } from "@/lib/format";
import { ROOM_TYPE_LABELS, GENDER_LABELS } from "@/lib/types";
import type { House } from "@/lib/types";
import { jobHubs, estimateCommute, commuteBand } from "@/lib/commute";
import { enrichHouse } from "@/lib/detail";
import { BookingWidget } from "@/components/BookingWidget";
import { ContactHostButton } from "@/components/ContactHostButton";
import { Gallery } from "@/components/Gallery";
import { DetailActions } from "@/components/DetailActions";
import { LocationMap } from "@/components/LocationMap";
import { USE_REAL_API } from "@/lib/api/config";
import { getRoom } from "@/lib/api/rooms";

// Render this page on demand so it always reads live data and the current
// USE_REAL_API value at request time — never a stale build-time snapshot.
// (Removing generateStaticParams + forcing dynamic avoids 404s when the DB
// holds ids that weren't known at build time.)
export const dynamic = "force-dynamic";
export const dynamicParams = true;

// Resolve a single listing: from the live API when enabled, else the demo seed.
async function loadHouse(id: string): Promise<House | null> {
  if (USE_REAL_API) {
    try {
      return await getRoom(id);
    } catch {
      return null;
    }
  }
  return houses.find((h) => h.id === id) ?? null;
}

// (No generateStaticParams: this route is force-dynamic, so every listing —
// demo or live — is resolved at request time via loadHouse.)

// Per-listing SEO metadata (title, description, OG image).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const house = await loadHouse(id);
  if (!house) return { title: "숙소를 찾을 수 없습니다" };
  const title = `${house.name.trim()} · ${house.region}`;
  const description = `${house.region}의 ${ROOM_TYPE_LABELS[house.roomType]} · 월 ${won(house.monthlyRent)} · ★ ${house.rating}. Nested에서 월 단위로 예약하세요.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `https://nested.kr/homes/${id}`,
    },
    alternates: { canonical: `https://nested.kr/homes/${id}` },
  };
}

// amenity → emoji icon
const AMENITY_ICON: Record<string, string> = {
  "Rooftop": "🏙️", "Coworking room": "💻", "Laundry": "🧺", "Fiber wifi": "📶",
  "Weekly cleaning": "🧹", "Gym": "🏋️", "Garden": "🌿", "Bike storage": "🚲",
  "Parcel locker": "📦", "Ensuite": "🚿", "Reading nook": "📚", "Yoga room": "🧘",
  "Workshop": "🛠️", "3D printers": "🖨️", "Terrace": "🌇", "River view": "🌊",
  "Communal dinners": "🍽️",
};

export default async function HomeDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hub?: string }>;
}) {
  const { id } = await params;
  const { hub: hubId } = await searchParams;
  const base = await loadHouse(id);
  if (!base) notFound();
  const house = enrichHouse(base);

  const hub = hubId ? jobHubs.find((h) => h.id === hubId) : null;
  const commute = hub ? estimateCommute(house.lat, house.lng, hub.lat, hub.lng) : null;
  const band = commute ? commuteBand(commute.minutes) : null;

  const avgRating = house.rating;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Accommodation",
    name: house.name.trim(),
    description: house.description,
    image: house.photo,
    address: { "@type": "PostalAddress", addressLocality: house.region, addressCountry: "KR" },
    numberOfRooms: house.capacity,
    petsAllowed: house.petsAllowed,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: house.rating,
      reviewCount: house.reviews,
    },
    offers: {
      "@type": "Offer",
      price: house.monthlyRent,
      priceCurrency: "KRW",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <div className="wrap" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Breadcrumb + title row */}
      <Link href="/search" style={{ color: "var(--secondary)", fontSize: 14, fontWeight: 600 }}>
        ← 검색으로 돌아가기
      </Link>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 16,
          marginTop: 14,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 className="display" style={{ fontSize: "clamp(24px, 3.4vw, 34px)" }}>
            {house.name.trim()}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 14, flexWrap: "wrap" }}>
            <span>★ {avgRating}</span>
            <span style={{ color: "var(--text-2)" }}>· 후기 {house.reviews}개</span>
            {house.host.superhost && (
              <span className="chip" style={{ fontSize: 12 }}>슈퍼호스트</span>
            )}
            <span style={{ color: "var(--text-2)" }}>· {house.region}, {house.city}</span>
          </div>
        </div>
        <DetailActions title={house.name.trim()} roomId={house.id} />
      </div>

      {/* ── Gallery ── */}
      <div style={{ marginTop: 18 }}>
        <Gallery images={house.gallery} color={house.color} alt={house.name.trim()} />
      </div>

      {/* Body: left content + right sticky booking */}
      <div className="detail-layout" style={{ marginTop: 32 }}>
        <div style={{ display: "grid", gap: 0 }}>
          {/* summary line */}
          <div style={{ paddingBottom: 22, borderBottom: "1px solid var(--border)" }}>
            <h2 className="display" style={{ fontSize: 20 }}>
              {ROOM_TYPE_LABELS[house.roomType]} · 최대 {house.capacity}명
            </h2>
            <p style={{ color: "var(--text-2)", fontSize: 14.5, marginTop: 4 }}>
              침실 {house.bedrooms}개 · 현재 거주 {house.residents}명 · {GENDER_LABELS[house.genderPolicy]} · 최소 {house.minStayMonths}개월
            </p>
          </div>

          {/* commute (only when arriving from commute search) */}
          {commute && hub && band && (
            <div
              className="card"
              style={{ margin: "22px 0 0", padding: 16, display: "flex", gap: 14, alignItems: "center", borderLeft: `3px solid ${band.color}` }}
            >
              <span style={{ fontSize: 24 }}>{commute.mode === "walk" ? "🚶" : "🚇"}</span>
              <div>
                <strong style={{ fontSize: 15.5 }}>{hub.name}까지 {commute.minutes}분</strong>
                <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 2 }}>
                  약 {commute.km}km · {hub.label}
                </div>
              </div>
            </div>
          )}

          {/* ── 호스트 소개 ── */}
          <Section title="호스트 소개">
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div
                style={{
                  width: 56, height: 56, borderRadius: 99, flexShrink: 0,
                  background: house.host.avatarColor,
                  display: "grid", placeItems: "center",
                  color: "#fff", fontWeight: 700, fontSize: 20,
                }}
                aria-hidden="true"
              >
                {house.host.name[0]}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ fontSize: 16 }}>{house.host.name} 호스트</strong>
                  {house.host.superhost && <span className="chip" style={{ fontSize: 11 }}>슈퍼호스트</span>}
                </div>
                <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 3 }}>
                  {house.host.since}년부터 호스팅 · 응답률 {house.host.responseRate}%
                </div>
              </div>
            </div>
            <ContactHostButton roomId={house.id} hostId={house.host.id} />
          </Section>

          {/* ── 방 소개 ── */}
          <Section title="방 소개">
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text)" }}>
              {house.description}
            </p>
          </Section>

          {/* ── 시설 ── */}
          <Section title="편의시설">
            <div className="amenity-grid">
              {house.amenities.map((a) => (
                <div key={a} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15 }}>
                  <span aria-hidden="true" style={{ fontSize: 18 }}>{AMENITY_ICON[a] ?? "✔️"}</span>
                  {a}
                </div>
              ))}
            </div>
            {/* vibe tags */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
              {house.vibe.map((v) => (
                <span key={v} className="chip">{v}</span>
              ))}
              {house.petsAllowed && <span className="chip">🐾 반려동물 가능</span>}
              {house.parking && <span className="chip">🅿️ 주차 가능</span>}
            </div>
          </Section>

          {/* ── 위치 ── */}
          <Section title="위치">
            <LocationMap lat={house.lat} lng={house.lng} region={house.region} color={house.color} />
          </Section>

          {/* ── 리뷰 / 평점 ── */}
          <Section title={`후기 ${house.reviews}개 · ★ ${avgRating}`}>
            <div className="review-grid">
              {house.houseReviews.map((r, i) => (
                <div key={i} className="card" style={{ padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 38, height: 38, borderRadius: 99, flexShrink: 0,
                        background: r.avatarColor, display: "grid", placeItems: "center",
                        color: "#fff", fontWeight: 700, fontSize: 15,
                      }}
                      aria-hidden="true"
                    >
                      {r.author[0]}
                    </div>
                    <div>
                      <strong style={{ fontSize: 14.5 }}>{r.author}</strong>
                      <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                        {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} · {r.date}
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: 14, color: "var(--text)", marginTop: 12, lineHeight: 1.6 }}>
                    {r.body}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Right: booking card */}
        <div>
          <BookingWidget house={house} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: "26px 0", borderBottom: "1px solid var(--border)" }}>
      <h2 className="display" style={{ fontSize: 21, marginBottom: 16 }}>{title}</h2>
      {children}
    </section>
  );
}
