ALTER TABLE "service_custom_domains"
  ADD COLUMN "provider" VARCHAR(40),
  ADD COLUMN "provider_configured_at" TIMESTAMPTZ(6),
  ADD COLUMN "verification_record_type" VARCHAR(20),
  ADD COLUMN "verification_record_name" VARCHAR(253),
  ADD COLUMN "verification_record_value" VARCHAR(1000),
  ADD COLUMN "provider_last_checked_at" TIMESTAMPTZ(6),
  ADD COLUMN "provider_error_code" VARCHAR(80);
