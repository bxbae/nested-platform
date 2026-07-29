"use client";

// 매출 추이 미니 라인 차트 (recharts 없이 순수 SVG).
// 기존 매출관리 페이지가 CSS 막대로 그리는 것과 톤을 맞추되,
// 시안처럼 매출·수수료 2개 선을 겹쳐 그린다.
//
// props.data 는 admin.ts 의 MonthlyTrendPoint[] 를 그대로 받는다:
//   { month: "6월", revenue: number, refunds: number, reservations: number }
// 수수료는 revenue * 0.05 로 파생한다(백엔드 commission 정책과 동일).

import { useState } from "react";

interface TrendPoint {
  month: string;
  revenue: number;
  reservations?: number;
}

export function RevenueTrendChart({ data }: { data: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  // 뷰박스 좌표계 (반응형: SVG가 컨테이너 폭에 맞춰 늘어남)
  const W = 640;
  const H = 220;
  const padX = 40;
  const padTop = 20;
  const padBottom = 36;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;

  const points = data.length > 0 ? data : [];
  const revenues = points.map((p) => p.revenue);
  const commissions = points.map((p) => Math.round(p.revenue * 0.05));
  const maxVal = Math.max(1, ...revenues, ...commissions); // 0 방지

  const xAt = (i: number) =>
    points.length <= 1 ? padX + innerW / 2 : padX + (innerW * i) / (points.length - 1);
  const yAt = (v: number) => padTop + innerH - (v / maxVal) * innerH;

  const linePath = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");

  const fmtWon = (n: number) =>
    n >= 10000 ? `${Math.round(n / 10000).toLocaleString()}만` : n.toLocaleString();

  // 가로 격자선 4등분
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((r) => padTop + innerH * r);

  return (
    <div style={{ width: "100%" }}>
      {/* 범례 */}
      <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 12 }}>
        <LegendDot color="var(--secondary)" label="매출" />
        <LegendDot color="var(--primary)" label="수수료" />
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        role="img"
        aria-label="월별 매출 추이"
      >
        {/* 격자 */}
        {gridYs.map((y, i) => (
          <line
            key={i}
            x1={padX}
            x2={W - padX}
            y1={y}
            y2={y}
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}

        {/* 매출 선 */}
        <path d={linePath(revenues)} fill="none" stroke="var(--secondary)" strokeWidth={2.5} />
        {/* 수수료 선 */}
        <path d={linePath(commissions)} fill="none" stroke="var(--primary)" strokeWidth={2.5} />

        {/* 점 + 호버 영역 */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={xAt(i)} cy={yAt(p.revenue)} r={hover === i ? 5 : 3.5} fill="var(--secondary)" />
            <circle cx={xAt(i)} cy={yAt(commissions[i])} r={hover === i ? 5 : 3.5} fill="var(--primary)" />
            {/* 투명한 넓은 호버 히트박스 */}
            <rect
              x={xAt(i) - innerW / (points.length * 2)}
              y={padTop}
              width={innerW / points.length}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
            {/* x축 라벨 */}
            <text x={xAt(i)} y={H - 12} textAnchor="middle" fontSize={12} fill="var(--text-2)">
              {p.month}
            </text>
          </g>
        ))}

        {/* 툴팁 */}
        {hover !== null && points[hover] && (
          <g>
            <line
              x1={xAt(hover)}
              x2={xAt(hover)}
              y1={padTop}
              y2={padTop + innerH}
              stroke="var(--text-2)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <g transform={`translate(${Math.min(xAt(hover) + 8, W - 130)}, ${padTop + 4})`}>
              <rect width={124} height={52} rx={8} fill="var(--surface)" stroke="var(--border)" />
              <text x={10} y={20} fontSize={12} fontWeight={700} fill="var(--text)">
                {points[hover].month}
              </text>
              <text x={10} y={36} fontSize={11} fill="var(--secondary)">
                매출 ₩{fmtWon(points[hover].revenue)}
              </text>
              <text x={10} y={48} fontSize={11} fill="var(--primary)">
                수수료 ₩{fmtWon(commissions[hover])}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-2)" }}>
      <span style={{ width: 10, height: 10, borderRadius: 999, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}
