-- Replace the stale age integer with a birth date. Age was a snapshot that
-- went out of date; birthDate lets us derive an age band (20s/30s/40s) and
-- detect birthdays for coupons. Existing age values can't be back-derived
-- into a date, so the column is dropped and users re-enter their birth date.
ALTER TABLE "User" DROP COLUMN "age";
ALTER TABLE "User" ADD COLUMN "birthDate" TIMESTAMP(3);
