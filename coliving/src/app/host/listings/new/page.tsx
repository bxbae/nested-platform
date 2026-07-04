"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { won } from "@/lib/format";
import { computePrice } from "@/lib/pricing";
import { ROOM_TYPE_LABELS, GENDER_LABELS, type RoomType, type GenderPolicy } from "@/lib/types";

const ROOM_TYPES: RoomType[] = ["one_room", "share_room", "whole_house", "apartment"];
const GENDERS: GenderPolicy[] = ["any", "female_only", "male_only"];
const AMENITIES = ["Rooftop", "Coworking room", "Laundry", "Fiber wifi", "Weekly cleaning", "Gym", "Garden", "Parcel locker"];

// ── Zod schema (validation source of truth) ──
const listingSchema = z.object({
  name: z.string().min(2, "숙소 이름을 2자 이상 입력하세요."),
  region: z.string().min(2, "위치(동네)를 입력하세요."),
  roomType: z.enum(["one_room", "share_room", "whole_house", "apartment"]),
  gender: z.enum(["any", "female_only", "male_only"]),
  monthlyRent: z.coerce.number().min(100000, "월세는 10만원 이상이어야 합니다."),
  deposit: z.coerce.number().min(0),
  cleaningFee: z.coerce.number().min(0),
  maintenanceFee: z.coerce.number().min(0),
  minStay: z.coerce.number().min(1).max(12),
});
type ListingForm = z.infer<typeof listingSchema>;

export default function NewListing() {
  const [photos, setPhotos] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<ListingForm>({
    resolver: zodResolver(listingSchema),
    mode: "onChange",
    defaultValues: {
      name: "", region: "", roomType: "one_room", gender: "any",
      monthlyRent: 700000, deposit: 3000000, cleaningFee: 70000, maintenanceFee: 50000, minStay: 3,
    },
  });

  const v = watch();
  const price = computePrice({
    monthlyRent: Number(v.monthlyRent) || 0,
    deposit: Number(v.deposit) || 0,
    cleaningFee: Number(v.cleaningFee) || 0,
    maintenanceFee: Number(v.maintenanceFee) || 0,
    months: Number(v.minStay) || 1,
  });

  function onFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).slice(0, 8).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setPhotos((prev) => [...prev, reader.result as string].slice(0, 8));
      reader.readAsDataURL(file);
    });
  }
  function toggleAmenity(a: string) {
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  if (submitted) {
    return (
      <div className="card" style={{ padding: 40, textAlign: "center", maxWidth: 460, margin: "40px auto" }}>
        <svg width="52" height="52" viewBox="0 0 40 40" style={{ margin: "0 auto 16px" }}>
          <circle cx="15" cy="20" r="11" stroke="var(--secondary)" strokeWidth="2.5" fill="none" />
          <circle cx="25" cy="20" r="11" stroke="var(--primary)" strokeWidth="2.5" fill="none" />
          <path d="M14 20 l4 4 l8 -9" stroke="var(--text)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <strong style={{ fontSize: 18 }}>숙소가 등록되었습니다</strong>
        <p style={{ color: "var(--text-2)", marginTop: 8 }}>검토 후 게시되며, 승인 결과를 알림으로 보내드립니다.</p>
        <button className="btn btn-primary press" style={{ marginTop: 18 }} onClick={() => window.location.assign("/host/listings")}>
          숙소 관리로 이동
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(() => setSubmitted(true))} style={{ maxWidth: 720 }}>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>숙소 등록</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 26 }}>
        사진과 정보를 입력하면 게스트에게 보여질 숙소가 만들어집니다.
      </p>

      {/* 사진 업로드 */}
      <Section title="사진 업로드" hint="최대 8장 · 첫 번째 사진이 대표 이미지가 됩니다">
        <div className="photo-grid">
          <button type="button" onClick={() => fileRef.current?.click()} className="press"
            style={{ border: "2px dashed var(--border)", borderRadius: "var(--r-md)", height: 120, display: "grid", placeItems: "center", background: "var(--bg-2)", color: "var(--text-2)", fontSize: 14 }}>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 24 }}>＋</div>사진 추가</div>
          </button>
          {photos.map((src, i) => (
            <div key={i} style={{ position: "relative", height: 120, borderRadius: "var(--r-md)", overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`업로드 사진 ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {i === 0 && <span className="chip" style={{ position: "absolute", top: 6, left: 6, fontSize: 10, background: "#fff" }}>대표</span>}
              <button type="button" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} aria-label="사진 삭제"
                style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 99, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 14, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </Section>

      {/* 기본 정보 (RHF register + Zod errors) */}
      <Section title="기본 정보">
        <div style={{ display: "grid", gap: 14 }}>
          <Field label="숙소 이름" error={errors.name?.message}>
            <input {...register("name")} placeholder="예) 성수 루프탑 하우스" />
          </Field>
          <Field label="위치 (동네)" error={errors.region?.message}>
            <input {...register("region")} placeholder="예) Seongsu-dong" />
          </Field>
          <Field label="방 종류">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ROOM_TYPES.map((rt) => (
                <button key={rt} type="button" className="chip" data-active={v.roomType === rt} onClick={() => setValue("roomType", rt)}>
                  {ROOM_TYPE_LABELS[rt]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="성별 조건">
            <div style={{ display: "flex", gap: 8 }}>
              {GENDERS.map((g) => (
                <button key={g} type="button" className="chip" data-active={v.gender === g} onClick={() => setValue("gender", g)} style={{ flex: 1, justifyContent: "center" }}>
                  {GENDER_LABELS[g]}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Section>

      {/* 가격 설정 */}
      <Section title="가격 설정">
        <div style={{ display: "grid", gap: 14 }}>
          <PriceField label="월세" error={errors.monthlyRent?.message} reg={register("monthlyRent")} step={10000} />
          <PriceField label="보증금" reg={register("deposit")} step={100000} />
          <PriceField label="청소비 (1회)" reg={register("cleaningFee")} step={10000} />
          <PriceField label="관리비 (월)" reg={register("maintenanceFee")} step={10000} />
          <Field label={`최소 계약 기간 · ${v.minStay}개월`}>
            <input type="range" min={1} max={12} {...register("minStay")} />
          </Field>
        </div>

        <div style={{ marginTop: 16, padding: 16, background: "var(--secondary-soft)", borderRadius: "var(--r-sm)", fontSize: 13.5 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>게스트 입주 시 결제 금액 미리보기</div>
          {[["보증금", price.deposit], ["첫 달 월세", price.monthlyRent], ["청소비", price.cleaningFee], ["관리비 (월)", price.maintenanceFee], ["서비스 수수료 (5%)", price.serviceFee]].map(([k, val]) => (
            <div key={k as string} style={{ display: "flex", justifyContent: "space-between", color: "var(--text-2)", padding: "2px 0" }}>
              <span>{k}</span><span>{won(val as number)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 8 }}>
            <span>합계</span><span>{won(price.dueNow)}</span>
          </div>
        </div>
      </Section>

      {/* 편의시설 */}
      <Section title="편의시설">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {AMENITIES.map((a) => (
            <button key={a} type="button" className="chip" data-active={amenities.includes(a)} onClick={() => toggleAmenity(a)}>{a}</button>
          ))}
        </div>
      </Section>

      <button type="submit" className="btn btn-primary press" style={{ width: "100%", justifyContent: "center", opacity: isValid ? 1 : 0.6 }} disabled={!isValid}>
        숙소 등록하기
      </button>
      {!isValid && <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 8, textAlign: "center" }}>필수 항목을 올바르게 입력하면 등록할 수 있어요.</p>}
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ padding: 22, marginBottom: 18 }}>
      <div style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 16 }}>{title}</strong>
        {hint && <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 3 }}>{hint}</div>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>{label}</div>
      {children}
      {error && <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 4 }}>{error}</div>}
    </label>
  );
}

function PriceField({ label, error, reg, step }: { label: string; error?: string; reg: any; step: number }) {
  return (
    <Field label={label} error={error}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "var(--text-2)" }}>₩</span>
        <input type="number" step={step} min={0} {...reg} style={{ flex: 1 }} />
      </div>
    </Field>
  );
}
