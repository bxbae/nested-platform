import Link from "next/link";
import { wonShort } from "@/lib/format";
import { ROOM_TYPE_LABELS } from "@/lib/types";
import { Thumbnail } from "@/components/Thumbnail";
import { HeroSearch } from "@/components/HeroSearch";
import { NoticeBar } from "@/components/NoticeBar";
import { HomeBanner } from "@/components/HomeBanner";
import {
  popularRegions,
  recommendedHomes,
  categories,
  totalListings,
} from "@/lib/landing";
import { loadHouses } from "@/lib/houses-source";
import type { House } from "@/lib/types";
import { getPersonalizedRooms } from "@/lib/api/rooms"; // 개인화 숙소 추천
import { PersonalizedSection } from "@/components/PersonalizedSection";
import { regionLabel } from "@/lib/seoul";

// Always render on demand so the recommended list reflects live DB rooms.
export const dynamic = "force-dynamic";

async function loadRecommended(limit = 4): Promise<House[]> {
  try {
    const all = await loadHouses();
    if (all.length > 0) return all.slice(0, limit);
  } catch {
    // fall through to demo seed on any error
  }
  return recommendedHomes(limit);
}

export default async function Home() {
  const regions = popularRegions(6);
  const recommended = await loadRecommended(4);
  const cats = categories();

  return (
    <>
      {/* 공지 띠 배너 (관리자 공지 공개 노출) */}
      <NoticeBar />

      {/* 메인 배너 (관리자 배너 공개 노출) */}
      <HomeBanner />

      {/* ── 1. Hero Banner + 2. 검색창 ── */}
      {/* NOTE: no overflow:hidden here — the date picker popover needs to escape
          this section. The backgrounds are clipped by their own wrapper below. */}
      <section style={{ position: "relative" }}>
        {/* Background layers, clipped to the section so nothing bleeds out. */}
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, overflow: "hidden" }}
        >
          {/* hero photo — sits to the right, behind the copy */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "url(/hero-coliving.jpg)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: 0.96,
            }}
          />
          {/* readability scrim: solid behind the text, clearing toward the photo */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
"linear-gradient(90deg, rgba(255,255,255,.98) 0%, rgba(255,255,255,.95) 30%, rgba(255,255,255,.68) 48%, rgba(255,255,255,.08) 72%)",
            }}
          />
          {/* warm brand gradient wash */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(1000px 500px at 15% -10%, #FF5A5F18, transparent 60%), radial-gradient(900px 480px at 100% 0%, #00A69915, transparent 55%)",
            }}
          />
        </div>
        <div
          className="wrap"
          style={{ position: "relative", paddingTop: 72, paddingBottom: 38 }}
        >
          <div style={{ maxWidth: "clamp(720px, 58vw, 900px)" }}>
            <span className="eyebrow">서울의 공유주거</span>
            <h1
              className="display"
              style={{ fontSize: "clamp(40px, 6vw, 68px)", marginTop: 18 }}
            >
              직장과 가까운 집,
              <br />
              마음 맞는 사람들과{" "}
              <span style={{ color: "var(--primary)" }}>함께.</span>
            </h1>
            <p
              style={{
                fontSize: 18,
                color: "var(--text-2)",
                marginTop: 20,
                lineHeight: 1.6,
                maxWidth: 520,
              }}
            >
출근 시간과 생활 성향을 기준으로 나에게 맞는 공유주거를 찾아보세요.
            </p>

            {/* 검색창 */}
            <div style={{ marginTop: 32 }}>
              <HeroSearch />
            </div>

            {/* 핵심 서비스 바로가기 */}
            <div className="hero-benefit-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 32 }}>
              {[
                { icon: "🚇", title: "짧은 출근 시간", body: "직장까지 실제 통근 시간이 짧은 숙소를 찾아보세요.", href: "/browse", cta: "직장 근처 숙소 →" },
                { icon: "👥", title: "마음 맞는 룸메이트", body: "생활 성향과 습관이 비슷한 사람을 매칭해드려요.", href: "/match", cta: "룸메이트 찾기 →" },
                { icon: "🛡️", title: "안심하고 편리한 주거", body: "호스트 확인과 관리자 승인을 거친 숙소를 둘러보세요.", href: "/search?verified=true", cta: "검증된 숙소 보기 →" },
              ].map((item) => (
                <Link key={item.title} href={item.href} className="card hover-card" style={{ padding: 16, display: "grid", gridTemplateColumns: "40px 1fr", gap: 12, alignItems: "start", background: "rgba(255,255,255,.9)" }}>
                  <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 999, background: "var(--bg-2)", display: "grid", placeItems: "center", fontSize: 20 }}>{item.icon}</span>
                  <span>
                    <strong style={{ display: "block", fontSize: 14.5 }}>{item.title}</strong>
                    <span style={{ display: "block", fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.45, marginTop: 4 }}>{item.body}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: "var(--secondary)", fontWeight: 700, marginTop: 8 }}>{item.cta}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. 인기 지역 ── */}
      <section className="section" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div className="wrap">
          <SectionHead
            eyebrow="인기 지역"
            title="지금 인기 있는 동네"
            href="/search"
            hrefLabel="전체 지역 보기"
          />
          <div className="region-grid">
            {regions.map((r) => (
              <Link key={r.district} href={`/search?district=${encodeURIComponent(r.district)}`} className="card hover-card" style={{ overflow: "hidden" }}>
                <div style={{ height: 126, backgroundImage: r.photo ? `linear-gradient(180deg, transparent 35%, rgba(0,0,0,.62)), url(${r.photo})` : "linear-gradient(135deg, var(--primary), var(--secondary))", backgroundSize: "cover", backgroundPosition: "center", display: "flex", alignItems: "flex-end", padding: 14 }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>{r.district}</span>
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ fontSize: 13, color: "var(--text-2)", minHeight: 38, lineHeight: 1.45 }}>{r.description}</div>
                  <div style={{ fontSize: 12.5, color: "var(--secondary)", fontWeight: 700, marginTop: 8 }}>숙소 {r.count}곳 →</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <PersonalizedSection />
      {/* ── 4. 추천 숙소 ── */}
      <section className="section" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div className="wrap">
        <SectionHead
            eyebrow="추천 숙소"
            title="이번 주 추천하는 집"
            href="/search"
            hrefLabel="더 둘러보기"
          />
          <div className="reco-grid">
            {recommended.map((h, i) => (
              <Link
                key={h.id}
                href={`/homes/${h.id}`}
                className="card hover-card reveal"
                style={{ overflow: "hidden", animationDelay: `${i * 0.07}s` }}
              >
                <Thumbnail src={h.photo} color={h.color} height={170}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      padding: 12,
                      height: "100%",
                    }}
                  >
                    <span
                      className="chip glass"
                      style={{ border: "none", color: "var(--text)", fontWeight: 600 }}
                    >
                      {ROOM_TYPE_LABELS[h.roomType]}
                    </span>
                    <span
                      className="chip glass"
                      style={{ border: "none", color: "var(--text)", fontSize: 12 }}
                    >
                      ★ {h.rating}
                    </span>
                  </div>
                </Thumbnail>
                <div style={{ padding: 15 }}>
                  <strong style={{ fontSize: 15 }}>{h.name.trim()}</strong>
                  <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 2 }}>
                    {regionLabel(h.region)} · 리뷰 {h.reviews}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 15 }}>
                    <strong>{wonShort(h.monthlyRent)}</strong>
                    <span style={{ color: "var(--text-2)", fontSize: 13 }}> / 월</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. 카테고리 ── */}
      <section className="section" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div className="wrap">
          <SectionHead eyebrow="카테고리" title="어떤 집을 찾으세요?" />
          <div className="cat-grid">
            {cats.map((c) => (
              <Link
                key={c.roomType}
                href={`/search?roomTypes=${c.roomType}`}
                className="card hover-card"
                style={{ padding: 22, display: "flex", flexDirection: "column", gap: 8 }}
              >
                <span style={{ fontSize: 30 }} aria-hidden="true">
                  {c.emoji}
                </span>
                <strong style={{ fontSize: 17 }}>{c.label}</strong>
                <span style={{ fontSize: 13.5, color: "var(--text-2)" }}>{c.blurb}</span>
                <span
                  style={{
                    marginTop: 4,
                    fontSize: 12.5,
                    color: "var(--secondary)",
                    fontWeight: 600,
                  }}
                >
                  {c.count}곳 →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. 서비스 소개 ── */}
      <section
        className="section"
        style={{ background: "var(--bg-2)", paddingTop: 72, paddingBottom: 72 }}
      >
        <div className="wrap">
          <SectionHead eyebrow="이용 방법" title="세 번의 겹침, 한 번의 입주" />
          <div className="how-grid">
            {[
              [
                "집을 찾고",
                "통근 시간, 예산, 원하는 분위기로 딱 맞는 셰어하우스를 검색하세요.",
                "/search",
                "검색하기",
              ],
              [
                "사람을 맞추고",
                "생활 리듬·성향을 기반으로 함께 살 룸메이트와의 궁합을 확인해요.",
                "/match",
                "매칭 보기",
              ],
              [
                "입주하기",
                "월 단위로 예약하고 보증금을 결제한 뒤, 하우스 커뮤니티에 참여하세요.",
                "/community",
                "커뮤니티",
              ],
            ].map(([t, d, href, cta], i) => (
              <div key={t as string} className="card" style={{ padding: 26 }}>
                <div
                  className="mono"
                  style={{ color: "var(--primary)", fontSize: 13, marginBottom: 14 }}
                >
                  0{i + 1}
                </div>
                <strong style={{ fontSize: 19, display: "block", marginBottom: 8 }}>
                  {t}
                </strong>
                <p style={{ color: "var(--text-2)", fontSize: 14.5, lineHeight: 1.6 }}>
                  {d}
                </p>
                <Link
                  href={href as string}
                  style={{
                    display: "inline-block",
                    marginTop: 16,
                    color: "var(--secondary)",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {cta} →
                </Link>
              </div>
            ))}
          </div>

          {/* closing CTA */}
          <div
            className="card"
            style={{
              marginTop: 28,
              padding: "32px 28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
              background: "linear-gradient(135deg, var(--primary), var(--secondary))",
              border: "none",
            }}
          >
            <div>
              <strong style={{ fontSize: 22, color: "#fff", display: "block" }}>
                오늘 바로 새 집을 찾아보세요
              </strong>
              <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 15 }}>
                {totalListings}개의 숙소가 입주를 기다리고 있어요.
              </span>
            </div>
            <Link
              href="/search"
              className="btn press"
              style={{
                background: "#fff",
                color: "var(--text)",
                padding: "14px 28px",
                whiteSpace: "nowrap",
              }}
            >
              숙소 검색하기
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHead({
  eyebrow,
  title,
  href,
  hrefLabel,
}: {
  eyebrow: string;
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 24,
        gap: 12,
      }}
    >
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="display" style={{ fontSize: 32, marginTop: 8 }}>
          {title}
        </h2>
      </div>
      {href && hrefLabel && (
        <Link
          href={href}
          style={{ color: "var(--secondary)", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap" }}
        >
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}
