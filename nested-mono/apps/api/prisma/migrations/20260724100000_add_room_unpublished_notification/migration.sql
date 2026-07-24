-- 게시 중단 알림 타입 추가
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ROOM_UNPUBLISHED';
