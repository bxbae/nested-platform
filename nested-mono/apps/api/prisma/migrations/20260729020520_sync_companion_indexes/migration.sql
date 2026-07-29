-- DropIndex — 인덱스가 없는 환경도 있어 IF EXISTS 로 안전하게 처리
DROP INDEX IF EXISTS "ReservationCompanionMember_individualPayment_status_idx";
