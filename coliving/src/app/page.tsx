import Link from "next/link";
import { wonShort } from "@/lib/format";
import { ROOM_TYPE_LABELS } from "@/lib/types";
import { Thumbnail } from "@/components/Thumbnail";
import { HeroSearch } from "@/components/HeroSearch";
import { NoticeBar } from "@/components/NoticeBar";
import { HomeBanner } from "@/components/HomeBanner";
import { popularRegions, recommendedHomes, totalListings } from "@/lib/landing";
import { loadHouses } from "@/lib/houses-source";
import type { House } from "@/lib/types";
import { PersonalizedSection } from "@/components/PersonalizedSection";
import { regionLabel } from "@/lib/seoul";

// 항상 최신 숙소 데이터를 반영하도록 요청 시점에 렌더링합니다.
export const dynamic = "force-dynamic";

async function loadRecommended(limit = 4): Promise<House[]> {
  try {
    const all = await loadHouses();
    if (all.length > 0) return all.slice(0, limit);
  } catch {
    // API 오류 시 시연용 추천 숙소 데이터를 사용합니다.
  }

  return recommendedHomes(limit);
}

export default async function Home() {
  const regions = popularRegions(6);
  const recommended = await loadRecommended(4);

  return (
    <>
      <NoticeBar />

      {/* 메인 히어로 */}
      <section
        style={{
          position: "relative",
          minHeight: 620,
          overflow: "visible",
          background: "#f7f2ec",
          zIndex: 10,
        }}
      >
        {/* 관리자가 등록한 메인 배너 이미지를 자동 슬라이드로 표시합니다. */}
        <HomeBanner />

        {/* 텍스트 가독성을 위한 아주 약한 밝기 보정만 적용합니다. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 42%, rgba(255,255,255,0) 62%)",
            pointerEvents: "none",
          }}
        />

        <div
          className="wrap"
          style={{
            position: "relative",
            minHeight: 620,
            paddingTop: 78,
            paddingBottom: 68,
            display: "flex",
            alignItems: "center",
            zIndex: 2,
          }}
        >
          <div style={{ width: "100%" }}>
            <div style={{ maxWidth: 680 }}>
              <span className="eyebrow">서울의 공유주거</span>

              <h1
                className="display"
                style={{
                  fontSize: "clamp(40px, 5.2vw, 68px)",
                  marginTop: 18,
                  lineHeight: 1.14,
                  letterSpacing: "-0.04em",
                }}
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
                  lineHeight: 1.65,
                  maxWidth: 540,
                }}
              >
                출근 시간과 생활 성향을 기준으로 나에게 맞는 공유주거를
                찾아보세요.
              </p>
            </div>

            <div
              className="hero-search-shell"
              style={{
                width: "min(1120px, 100%)",
                margin: "34px auto 0",
                position: "relative",
                zIndex: 5,
              }}
            >
              <HeroSearch />
            </div>
          </div>
        </div>
      </section>

      {/* 이용 방법 */}
      <section
        className="section"
        style={{
          background: "var(--bg-2)",
          paddingTop: 72,
          paddingBottom: 72,
        }}
      >
        <div className="wrap">
          <SectionHead eyebrow="이용 방법" title="세 번의 검증, 한 번의 입주" />

          <div className="how-grid">
            {[
              [
                "집을 찾고",
                "통근 시간, 예산, 주거 형태를 기준으로 나에게 맞는 숙소를 찾아보세요.",
                "/search",
                "검색하기",
              ],
              [
                "사람을 맞추고",
                "생활 성향과 습관을 기준으로 함께 살 룸메이트와의 궁합을 확인해보세요.",
                "/match",
                "매칭 보기",
              ],
              [
                "입주하기",
                "호스트와 관리자가 확인한 숙소를 예약하고 새로운 생활을 시작해보세요.",
                "/search?verified=true",
                "검증 숙소 보기",
              ],
            ].map(([title, description, href, cta], index) => (
              <div key={title} className="card" style={{ padding: 26 }}>
                <div
                  className="mono"
                  style={{
                    color: "var(--primary)",
                    fontSize: 13,
                    marginBottom: 14,
                  }}
                >
                  0{index + 1}
                </div>

                <strong
                  style={{
                    fontSize: 19,
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  {title}
                </strong>

                <p
                  style={{
                    color: "var(--text-2)",
                    fontSize: 14.5,
                    lineHeight: 1.6,
                  }}
                >
                  {description}
                </p>

                <Link
                  href={href}
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
              background:
                "linear-gradient(135deg, var(--primary), var(--secondary))",
              border: "none",
            }}
          >
            <div>
              <strong
                style={{
                  fontSize: 22,
                  color: "#fff",
                  display: "block",
                }}
              >
                오늘 바로 새 집을 찾아보세요
              </strong>

              <span
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 15,
                }}
              >
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

      {/* 인기 지역 */}
      <section
        className="section"
        style={{ paddingTop: 40, paddingBottom: 40 }}
      >
        <div className="wrap">
          <SectionHead
            eyebrow="인기 지역"
            title="지금 인기 있는 동네"
            href="/search"
            hrefLabel="전체 지역 보기"
          />

          <div className="region-grid">
            {regions.map((region) => (
              <Link
                key={region.district}
                href={`/search?district=${encodeURIComponent(region.district)}`}
                className="card hover-card"
                style={{ overflow: "hidden" }}
              >
                <div
                  style={{
                    height: 126,
                    backgroundImage: region.photo
                      ? `linear-gradient(180deg, transparent 35%, rgba(0,0,0,.62)), url(${region.photo})`
                      : "linear-gradient(135deg, var(--primary), var(--secondary))",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    display: "flex",
                    alignItems: "flex-end",
                    padding: 14,
                  }}
                >
                  <span
                    style={{
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 17,
                    }}
                  >
                    {region.district}
                  </span>
                </div>

                <div style={{ padding: "12px 14px" }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-2)",
                      minHeight: 38,
                      lineHeight: 1.45,
                    }}
                  >
                    {region.description}
                  </div>

                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--secondary)",
                      fontWeight: 700,
                      marginTop: 8,
                    }}
                  >
                    숙소 {region.count}곳 →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <PersonalizedSection />

      {/* 추천 숙소 */}
      <section
        className="section"
        style={{ paddingTop: 40, paddingBottom: 40 }}
      >
        <div className="wrap">
          <SectionHead
            eyebrow="추천 숙소"
            title="이번 주 추천하는 집"
            href="/search"
            hrefLabel="더 둘러보기"
          />

          <div className="reco-grid">
            {recommended.map((house, index) => (
              <Link
                key={house.id}
                href={`/homes/${house.id}`}
                className="card hover-card reveal"
                style={{
                  overflow: "hidden",
                  animationDelay: `${index * 0.07}s`,
                }}
              >
                <Thumbnail src={house.photo} color={house.color} height={170}>
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
                      style={{
                        border: "none",
                        color: "var(--text)",
                        fontWeight: 600,
                      }}
                    >
                      {ROOM_TYPE_LABELS[house.roomType]}
                    </span>

                    <span
                      className="chip glass"
                      style={{
                        border: "none",
                        color: "var(--text)",
                        fontSize: 12,
                      }}
                    >
                      ★ {house.rating}
                    </span>
                  </div>
                </Thumbnail>

                <div style={{ padding: 15 }}>
                  <strong style={{ fontSize: 15 }}>{house.name.trim()}</strong>

                  <div
                    style={{
                      color: "var(--text-2)",
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    {regionLabel(house.region)} · 리뷰 {house.reviews}
                  </div>

                  <div style={{ marginTop: 10, fontSize: 15 }}>
                    <strong>{wonShort(house.monthlyRent)}</strong>
                    <span
                      style={{
                        color: "var(--text-2)",
                        fontSize: 13,
                      }}
                    >
                      {" "}
                      / 월
                    </span>
                  </div>
                </div>
              </Link>
            ))}
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
        <h2
          className="display"
          style={{
            fontSize: 32,
            marginTop: 8,
          }}
        >
          {title}
        </h2>
      </div>

      {href && hrefLabel && (
        <Link
          href={href}
          style={{
            color: "var(--secondary)",
            fontWeight: 600,
            fontSize: 14,
            whiteSpace: "nowrap",
          }}
        >
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}
