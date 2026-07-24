import type { Metadata } from "next";
import Link from "next/link";
import styles from "./about.module.css";
import AboutFaq from "./AboutFaq";

// 원본 nested-about.html 을 변환.
// - <header>/<nav>, 모바일 메뉴 토글, <footer> 는 옮기지 않았다 — RootLayout
//   (src/app/layout.tsx) 이 <Nav />와 전역 footer를 모든 페이지에 이미 렌더링한다.
// - 신뢰·안전 카드의 스크롤 등장 애니메이션(IntersectionObserver)은 페이지를
//   서버 컴포넌트로 유지하기 위해 생략했다. 다시 넣고 싶다면 해당 섹션만
//   "use client" 하위 컴포넌트로 분리하면 된다.
// - FAQ 아코디언만 상호작용이 필요해 AboutFaq.tsx(client component)로 분리했다.

export const metadata: Metadata = {
  title: "Nested 소개 — 우리가 셰어하우스를 다시 만드는 이유",
  description:
    "Nested의 미션, 신뢰·안전 장치, 호스트 프로그램, 커뮤니티 운영 방식을 소개합니다.",
};

export default function AboutPage() {
  return (
    <>
      <section className={styles.hero} id="mission">
        <div className={styles.heroBg} aria-hidden="true" />
        <div className="wrap">
          <span className={`${styles.eyebrow2} ${styles.teal}`}>Nested 소개</span>
          <h1 className="display">
            &ldquo;같이 살 사람&rdquo;을 못 구해서
            <br />
            원룸을 택하는 사람이 너무 많았어요.
          </h1>
          <p className={styles.lede}>
            셰어하우스는 월세를 아낄 수 있지만, 낯선 사람과 계약서 한 장으로
            몇 달을 함께 사는 일이에요. Nested는 이 결정을 카톡 몇 번과
            계좌이체로 끝내지 않기 위해 만든 서비스예요 — 매물 검수, 신원 확인,
            보증금 보호까지 플랫폼이 직접 책임집니다.
          </p>
        </div>
      </section>

      <section className={`${styles.section} ${styles.alt}`}>
        <div className="wrap">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow2}>문제와 해법</span>
            <h2 className="display">기존 방식의 무엇이 불안했나요.</h2>
          </div>
          <div className={styles.split}>
            <div className={`${styles.splitCol} ${styles.problem}`}>
              <span className={styles.splitTag}>기존 카페·부동산 카페 거래</span>
              <h3>개인 간 직거래</h3>
              <ul className={styles.splitList}>
                <li>매물 사진과 실제 상태가 다른 경우가 많았어요</li>
                <li>집주인·룸메이트의 신원을 확인할 방법이 없었어요</li>
                <li>보증금을 개인 계좌로 바로 보내야 했어요</li>
                <li>입주 후 분쟁이 생기면 중재해줄 곳이 없었어요</li>
              </ul>
            </div>
            <div className={`${styles.splitCol} ${styles.solution}`}>
              <span className={styles.splitTag}>Nested</span>
              <h3>플랫폼이 보증하는 거래</h3>
              <ul className={styles.splitList}>
                <li>모든 매물은 등록 전 운영팀 실사·승인을 거쳐요</li>
                <li>본인인증을 완료한 사용자만 예약할 수 있어요</li>
                <li>보증금은 플랫폼이 예치하고 입주 확인 후 정산돼요</li>
                <li>분쟁 발생 시 운영팀이 직접 개입해 조정해요</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="trust">
        <div className="wrap">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow2}>신뢰·안전</span>
            <h2 className="display">매물 하나가 올라오기까지, 4단계를 거쳐요.</h2>
            <p>화려한 사진 한 장이 아니라, 실제로 검증된 매물만 노출하는 걸 원칙으로 해요.</p>
          </div>
          <div className={styles.trustGrid}>
            <div className={styles.trustCard}>
              <div className={styles.trustStep}>STEP 01 · 서류 검토</div>
              <h3>사업자 등록·소유권 확인</h3>
              <p>호스트가 매물을 등록하면 사업자 정보와 매물 소유·임대 권한을 서류로 먼저 확인해요.</p>
            </div>
            <div className={styles.trustCard}>
              <div className={styles.trustStep}>STEP 02 · 운영팀 승인</div>
              <h3>게시 전 검수</h3>
              <p>사진, 시세, 옵션 정보가 실제와 맞는지 운영팀이 확인한 뒤에만 검색 결과에 노출돼요.</p>
            </div>
            <div className={styles.trustCard}>
              <div className={styles.trustStep}>STEP 03 · 예약 보호</div>
              <h3>보증금 에스크로</h3>
              <p>보증금과 첫 달 월세는 입주 확인 전까지 플랫폼이 보관하고, 이상 없을 때만 호스트에게 정산돼요.</p>
            </div>
            <div className={styles.trustCard}>
              <div className={styles.trustStep}>STEP 04 · 상시 모니터링</div>
              <h3>신고·분쟁 대응</h3>
              <p>입주 후에도 신고가 접수되면 운영팀이 확인 후 매물을 비노출 처리하거나 계약을 중재해요.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.alt}`} id="host">
        <div className="wrap">
          <div className={styles.hostSection}>
            <div className={styles.hostCopy}>
              <span className={styles.eyebrow2}>호스트를 위한 이야기</span>
              <h2 className="display">공실 걱정 없이, 정산은 투명하게.</h2>
              <p>
                Nested 호스트는 매물 등록부터 입주자 관리, 정산까지 하나의
                대시보드에서 처리해요. 공실 기간에는 노출 우선순위를 자동으로
                올려드리고, 정산은 매달 같은 날 자동으로 들어와요.
              </p>
              <div className={styles.hostStats}>
                <div className={styles.hostStat}>
                  <div className={styles.num}>3.2%</div>
                  <div className={styles.label}>평균 플랫폼 수수료</div>
                </div>
                <div className={styles.hostStat}>
                  <div className={styles.num}>매월 5일</div>
                  <div className={styles.label}>정기 정산일</div>
                </div>
                <div className={styles.hostStat}>
                  <div className={styles.num}>평균 9일</div>
                  <div className={styles.label}>등록 후 첫 예약까지</div>
                </div>
                <div className={styles.hostStat}>
                  <div className={styles.num}>92%</div>
                  <div className={styles.label}>공실 대비 재계약률</div>
                </div>
              </div>
            </div>
            <div className={styles.hostPanel}>
              <div className={styles.hostPanelTitle}>이번 달 정산 미리보기</div>
              <div className={styles.panelRow}>
                <span>입금 예정 매물</span>
                <span>4건</span>
              </div>
              <div className={styles.panelRow}>
                <span>월세 합계</span>
                <span>₩3,120,000</span>
              </div>
              <div className={styles.panelRow}>
                <span>플랫폼 수수료 (3.2%)</span>
                <span>−₩99,840</span>
              </div>
              <div className={styles.panelRow}>
                <span>정산 예정일</span>
                <span>07.05</span>
              </div>
              <div className={styles.panelRow}>
                <span>실입금액</span>
                <span>₩3,020,160</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="wrap">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow2}>입주 이후</span>
            <h2 className="display">계약은 시작일 뿐, 진짜는 함께 사는 시간이에요.</h2>
          </div>
          <div className={styles.communityGrid}>
            <div className={styles.commCard}>
              <span className={styles.tag}>라운지</span>
              <h3>공용공간 예약</h3>
              <p>세탁실, 라운지, 스터디룸 같은 공용공간을 앱에서 시간 단위로 예약해요.</p>
            </div>
            <div className={styles.commCard}>
              <span className={styles.tag}>모임</span>
              <h3>하우스 소모임</h3>
              <p>같은 하우스 입주자끼리 정기 모임을 만들고, 게시판에서 일정을 조율해요.</p>
            </div>
            <div className={styles.commCard}>
              <span className={styles.tag}>리뷰</span>
              <h3>입주 이력 기반 후기</h3>
              <p>실제로 그 집에 살았던 사람만 후기를 남길 수 있어서, 광고성 리뷰가 섞이지 않아요.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.alt}`}>
        <div className="wrap">
          <div className={styles.impactStrip}>
            <div className={styles.impactCell}>
              <div className={styles.impactNum}>128</div>
              <div className={styles.impactLabel}>검수 완료 매물</div>
            </div>
            <div className={styles.impactCell}>
              <div className={styles.impactNum}>21곳</div>
              <div className={styles.impactLabel}>서울 내 운영 지역</div>
            </div>
            <div className={styles.impactCell}>
              <div className={styles.impactNum}>5.2일</div>
              <div className={styles.impactLabel}>평균 매칭 성사 기간</div>
            </div>
            <div className={styles.impactCell}>
              <div className={styles.impactNum}>0건</div>
              <div className={styles.impactLabel}>보증금 미반환 사례</div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="faq">
        <div className="wrap">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow2}>자주 묻는 질문</span>
            <h2 className="display">계약 전에 가장 많이 물어보시는 것들.</h2>
          </div>
          <AboutFaq />
        </div>
      </section>

      <section className={`${styles.section} ${styles.alt}`}>
        <div className="wrap">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow2}>한눈에 보기</span>
            <h2 className="display">Nested 안에는 이런 기능들이 있어요.</h2>
            <p>
              같은 &ldquo;방 구하기&rdquo;라도 시스템이 자동으로 찾아주는
              기능과, 사람이 직접 글을 올리는 게시판은 서로 달라요. 헷갈리지
              않도록 정리했어요.
            </p>
          </div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={`${styles.summaryKind} ${styles.auto}`}>자동 기능</span>
              <h3>숙소 검색</h3>
              <p>통근 시간, 예산, 지역 조건을 입력하면 시스템이 조건에 맞는 매물을 자동으로 찾아줘요.</p>
            </div>
            <div className={styles.summaryCard}>
              <span className={`${styles.summaryKind} ${styles.auto}`}>자동 기능</span>
              <h3>룸메이트 매칭</h3>
              <p>생활 패턴, 흡연·반려동물 여부 같은 정보를 바탕으로 궁합이 맞는 룸메이트를 시스템이 추천해요.</p>
            </div>
            <div className={styles.summaryCard}>
              <span className={`${styles.summaryKind} ${styles.board}`}>게시판</span>
              <h3>방 구하기 게시판</h3>
              <p>
                검색으로는 안 나오는 조건도 괜찮아요. &ldquo;이런 방
                구해요&rdquo;라고 직접 글을 올리면, 조건에 맞는 호스트나 다른
                사용자가 댓글로 연락해요.
              </p>
            </div>
            <div className={styles.summaryCard}>
              <span className={`${styles.summaryKind} ${styles.board}`}>게시판</span>
              <h3>같이 집 구하기 게시판</h3>
              <p>
                매칭 알고리즘을 거치지 않고, &ldquo;같이 집 구할 사람
                찾아요&rdquo;라고 직접 글을 올려서 원하는 사람과 자유롭게 팀을
                꾸릴 수 있어요.
              </p>
            </div>
          </div>
          <div className={styles.summaryNote}>
            💡{" "}
            <span>
              <b>자동 기능</b>은 조건을 입력하면 시스템이 대신 찾아주는
              기능이고, <b>게시판</b>은 사용자가 직접 글을 쓰고 댓글로
              소통하는 커뮤니티 공간이에요. 검색 결과가 마음에 안 들 때는
              게시판에 직접 글을 올려보세요.
            </span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="wrap">
          <div className={styles.cta}>
            <h2 className="display">궁금한 점이 더 있다면, 직접 물어보세요.</h2>
            <p>운영팀이 매물 검수부터 계약까지 직접 확인해드려요.</p>
            <Link href="/support" className="btn btn-primary" style={{ padding: "14px 30px", fontSize: 15.5 , fontWeight: 800}}>
              문의하기
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
