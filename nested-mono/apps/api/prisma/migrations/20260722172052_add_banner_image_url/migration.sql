-- Hero banner image (Cloudinary/CDN URL). Added in the banner-slider feature;
-- the column was defined in schema.prisma but shipped without a migration.
ALTER TABLE "Banner" ADD COLUMN "imageUrl" TEXT;
