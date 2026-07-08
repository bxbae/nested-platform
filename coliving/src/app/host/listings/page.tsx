import Link from "next/link";
import { won } from "@/lib/format";
import { ROOM_TYPE_LABELS } from "@/lib/types";
import { myListings } from "@/lib/host";
import { loadHouses } from "@/lib/houses-source";
import { Thumbnail } from "@/components/Thumbnail";
import type { House } from "@/lib/types";

export const metadata = { title: "숙소 관리 · Nested 호스트" };
export const dynamic = "force-dynamic";

// Live DB rooms when enabled (so 미리보기 links resolve), else demo seed.
async function loadListings(): Promise<House[]> {
  try {
    const all = await loadHouses();
    if (all.length > 0) return all;
  } catch {
    // fall through to demo seed
  }
  return myListings();
}

export default async function HostListings() {
  const listings = await loadListings();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 className="display" style={{ fontSize: 30 }}>숙소 관리</h1>
          <p style={{ color: "var(--text-2)", marginTop: 4 }}>등록한 숙소를 관리하고 수정하세요.</p>
        </div>
        <Link href="/host/listings/new" className="btn btn-primary press">+ 숙소 등록</Link>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {listings.map((h) => (
          <div key={h.id} className="card" style={{ overflow: "hidden", display: "flex", flexWrap: "wrap" }}>
            <div style={{ width: 180, minWidth: 140, flex: "1 1 140px", maxWidth: 220 }}>
              <Thumbnail src={h.photo} color={h.color} height="100%">
                <div />
              </Thumbnail>
            </div>
            <div style={{ flex: "3 1 300px", padding: 18, display: "flex", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ fontSize: 16 }}>{h.name.trim()}</strong>
                  <span className="chip" style={{ fontSize: 11 }}>{ROOM_TYPE_LABELS[h.roomType]}</span>
                  <span
                    className="chip"
                    style={{ fontSize: 11, background: "var(--secondary)", color: "#fff", border: "none" }}
                  >
                    게시중
                  </span>
                </div>
                <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 4 }}>
                  {h.region}, {h.city} · ★ {h.rating} · 후기 {h.reviews}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13, color: "var(--text-2)", flexWrap: "wrap" }}>
                  <span>월세 {won(h.monthlyRent)}</span>
                  <span>보증금 {won(h.deposit)}</span>
                  <span>청소비 {won(h.cleaningFee)}</span>
                  <span>입주 {h.residents}/{h.capacity}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
                <Link href={`/homes/${h.id}`} className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 14px" }}>
                  미리보기
                </Link>
                <button className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 14px" }}>
                  수정
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
