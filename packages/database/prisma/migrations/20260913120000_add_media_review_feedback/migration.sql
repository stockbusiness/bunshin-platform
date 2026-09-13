ALTER TABLE "video_projects"
  ADD COLUMN "review_reason" VARCHAR(80),
  ADD COLUMN "review_note" VARCHAR(500);

ALTER TABLE "social_image_generated_media"
  ADD COLUMN "review_reason" VARCHAR(80),
  ADD COLUMN "review_note" VARCHAR(500);
