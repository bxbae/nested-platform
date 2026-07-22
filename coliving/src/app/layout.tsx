import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Rings } from "@/components/Rings";
import { PushListener } from "@/components/PushListener";
import { QueryProvider } from "@/components/QueryProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";

export const metadata: Metadata = {
  metadataBase: new URL("https://nested.kr"),
  title: {
    default: "Nested — 공유주거 플랫폼",
    template: "%s · Nested",
  },
  description:
    "직장과 가까운 셰어하우스를 찾고, 마음 맞는 룸메이트와 매칭하고, 월 단위로 예약하세요. 통근 시간·예산·라이프스타일 맞춤 검색.",
  keywords: [
    "셰어하우스",
    "공유주거",
    "코리빙",
    "룸메이트",
    "월세",
    "장기임대",
    "co-living",
  ],
  authors: [{ name: "Nested" }],
  applicationName: "Nested",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "Nested",
    title: "Nested — 공유주거 플랫폼",
    description:
      "직장과 가까운 셰어하우스를 찾고, 마음 맞는 룸메이트와 매칭하세요.",
    url: "https://nested.kr",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nested — 공유주거 플랫폼",
    description: "직장과 가까운 셰어하우스, 룸메이트 매칭, 월 단위 예약.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: "https://nested.kr" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme:dark)').matches;var c=document.documentElement.classList;c.toggle('dark',d);c.toggle('light',!d);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <LanguageProvider>
          <QueryProvider>
            <Nav />
            <PushListener />
            <main>{children}</main>

            <footer
              style={{
                borderTop: "1px solid var(--border)",
                marginTop: 40,
                background: "var(--bg-2)",
              }}
            >
              <div className="wrap" style={{ padding: "48px 24px 32px" }}>
                <div className="footer-grid">
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <Rings size={24} />
                      <strong className="display" style={{ fontSize: 19 }}>
                        Nested
                      </strong>
                    </div>
                    <p
                      style={{
                        color: "var(--text-2)",
                        fontSize: 13.5,
                        maxWidth: 260,
                        lineHeight: 1.6,
                      }}
                    >
                      20~40대 직장인과 장기 거주자를 위한 공유주거 플랫폼.
                    </p>
                  </div>
                  <FooterCol
                    title="둘러보기"
                    links={[
                      ["숙소 검색", "/search"],
                      ["통근 검색", "/browse"],
                      ["룸메이트 매칭", "/match"],
                    ]}
                  />
                  <FooterCol
                    title="커뮤니티"
                    links={[
                      ["하우스 피드", "/community"],
                      ["예약 내역", "/trips"],
                    ]}
                  />
                  <FooterCol
                    title="회사"
                    links={[
                      ["서비스 소개", "/"],
                      ["이용약관", "/"],
                      ["개인정보처리방침", "/"],
                    ]}
                  />
                </div>
                <div
                  style={{
                    marginTop: 32,
                    paddingTop: 20,
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                    color: "var(--text-2)",
                    fontSize: 13,
                  }}
                >
                  <span className="mono">© 2026 Nested · Seoul</span>
                  <span>서울의 셰어하우스를 잇는 두 개의 원.</span>
                </div>
              </div>
            </footer>
          </QueryProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: [string, string][];
}) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
        {title}
      </div>
      <ul style={{ listStyle: "none", display: "grid", gap: 8 }}>
        {links.map(([label, href]) => (
          <li key={label}>
            <a
              href={href}
              style={{ color: "var(--text-2)", fontSize: 13.5 }}
              className="footer-link"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
