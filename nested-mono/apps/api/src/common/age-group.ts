// 배치 위치: src/common/age-group.ts
//
// 연령대 (Age band).
//
// Derived on read from birthDate. We never expose the raw birth date to other
// users — only the decade band (20대/30대/…). Lives in common/ because auth
// (내 프로필), match (상대 카드), friends, and users (공개 프로필) all render it.

// Full age in years from a birth date, or null if not set.
export function ageFromBirthDate(birthDate: Date | null | undefined): number | null {
  if (!birthDate) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age >= 0 && age < 150 ? age : null;
}

// Decade band for display: 25 → 20, 31 → 30. Returns null when unknown or
// under 20 (we don't label teens). The frontend renders `${band}대`.
export function ageGroup(birthDate: Date | null | undefined): number | null {
  const age = ageFromBirthDate(birthDate);
  if (age === null || age < 20) return null;
  return Math.floor(age / 10) * 10;
}

// True when today is the user's birthday (month + day match). Used by the
// birthday-coupon flow.
export function isBirthday(birthDate: Date | null | undefined, today = new Date()): boolean {
  if (!birthDate) return false;
  return (
    birthDate.getMonth() === today.getMonth() &&
    birthDate.getDate() === today.getDate()
  );
}
