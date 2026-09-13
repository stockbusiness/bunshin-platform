ALTER TABLE "bunshin_memories"
  ADD COLUMN "automatic_image_reference" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "bunshin_memories_one_automatic_image_reference_idx"
  ON "bunshin_memories"("workspace_id", "bunshin_id")
  WHERE "automatic_image_reference" = true
    AND "active" = true
    AND "deleted_at" IS NULL;
