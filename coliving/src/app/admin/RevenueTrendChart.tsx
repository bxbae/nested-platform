"use client";

// 매출 추이 미니 라인 차트 (recharts 없이 순수 SVG).
// 매출/수수료/순수익 3개 선을 겹쳐 그린다.
//
// 순수익 = 매출 - 수수료(매출의 5%). 대시보드 KPI 카드의 "이번 달
// 순수익"(어림계산상 수수료와 같은 값)이랑 정의가 다르다 — 여기서 세
// 선이 다 겹쳐 보이면 그래프로서 의미가 없어서, "매출에서 수수료를 뗀
// 나머지"로 따로 정의했다.
//
// 범례(RevenueTrendLegend)는 일부러 이 컴포넌트 밖으로 뺐다 — "매출
// 추이" 제목이랑 같은 줄에 나란히 놓고 싶다는 요청이라, 제목을 그리는
// 쪽(admin/page.tsx)에서 같이 배치할 수 있게 분리했다.

import { useState } from "react";

interface TrendPoint {
  label: string;
  revenue: number;
  commission: number;
  netProfit: number;
}

const COLORS = {
  revenue: "var(--secondary)",
  commission: "var(--primary)",
  netProfit: "var(--text-2)",
};

export function RevenueTrendLegend() {
  return (
    <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
      <LegendDot color={COLORS.revenue} label="매출" />
      <LegendDot color={COLORS.commission} label="수수료" />
      <LegendDot color={COLORS.netProfit} label="순수익" />
    </div>
  );
}

export function RevenueTrendChart({ data }: { data: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  // 뷰박스 좌표계 (반응형: SVG가 컨테이너 폭에 맞춰 늘어남)
  const W = 640;
  const H = 320;
  const padX = 40;
  const padTop = 20;
  const padBottom = 36;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;

  const points = data.length > 0 ? data : [];
  const revenues = points.map((p) => p.revenue);
  const commissions = points.map((p) => p.commission);
  const netProfits = points.map((p) => p.netProfit);
  const maxVal = Math.max(1, ...revenues, ...commissions, ...netProfits); // 0 방지

  const xAt = (i: number) =>
    points.length <= 1 ? padX + innerW / 2 : padX + (innerW * i) / (points.length - 1);
  const yAt = (v: number) => padTop + innerH - (v / maxVal) * innerH;

  const linePath = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");

  const fmtWon = (n: number) =>
    n >= 10000 ? `${Math.round(n / 10000).toLocaleString()}만` : n.toLocaleString();

  // 가로 격자선 4등분
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((r) => padTop + innerH * r);

  // x축 라벨이 너무 많으면(일별 31개) 다 겹쳐 보이니, 간격을 둬서 일부만
  // 표시한다.
  const labelEvery = points.length > 12 ? Math.ceil(points.length / 8) : 1;

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        role="img"
        aria-label="매출·수수료·순수익 추이"
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

        {/* 세 선 */}
        <path d={linePath(netProfits)} fill="none" stroke={COLORS.netProfit} strokeWidth={2.5} />
        <path d={linePath(commissions)} fill="none" stroke={COLORS.commission} strokeWidth={2.5} />
        <path d={linePath(revenues)} fill="none" stroke={COLORS.revenue} strokeWidth={2.5} />

        {/* 점 + 호버 영역 + x축 라벨 */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={xAt(i)} cy={yAt(p.revenue)} r={hover === i ? 5 : 3.5} fill={COLORS.revenue} />
            <circle cx={xAt(i)} cy={yAt(p.commission)} r={hover === i ? 5 : 3.5} fill={COLORS.commission} />
            <circle cx={xAt(i)} cy={yAt(p.netProfit)} r={hover === i ? 5 : 3.5} fill={COLORS.netProfit} />
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
            {i % labelEvery === 0 && (
            <text x={xAt(i)} y={H - 12} textAnchor="middle" fontSize={12} fill="var(--text-2)">
                {p.label}
            </text>
            )}
          </g>
        ))}

        {/* 툴팁 — 매출/수수료/순수익 세 값 다 표시 */}
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
            <g transform={`translate(${Math.min(xAt(hover) + 8, W - 132)}, ${padTop + 4})`}>
              <rect width={126} height={66} rx={8} fill="var(--surface)" stroke="var(--border)" />
              <text x={10} y={18} fontSize={12} fontWeight={700} fill="var(--text)">
                {points[hover].label}
              </text>
              <text x={10} y={34} fontSize={11} fill={COLORS.revenue}>
                매출 ₩{fmtWon(points[hover].revenue)}
              </text>
              <text x={10} y={48} fontSize={11} fill={COLORS.commission}>
                수수료 ₩{fmtWon(points[hover].commission)}
              </text>
              <text x={10} y={62} fontSize={11} fill={COLORS.netProfit}>
                순수익 ₩{fmtWon(points[hover].netProfit)}
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
