ALTER TABLE "external_tracking_systems"
  ADD COLUMN "result_ingest_token_hash" VARCHAR(64),
  ADD COLUMN "result_ingest_token_prefix" VARCHAR(16),
  ADD COLUMN "result_ingest_token_created_at" TIMESTAMPTZ(6),
  ADD COLUMN "last_result_received_at" TIMESTAMPTZ(6);

CREATE TABLE "external_tracking_results" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "system_id" UUID NOT NULL,
  "external_event_id" VARCHAR(200) NOT NULL,
  "metric_type" VARCHAR(40) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "amount_minor" INTEGER,
  "currency" VARCHAR(3),
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "external_tracking_link_id" UUID,
  "member_identity_id" UUID,
  CONSTRAINT "external_tracking_results_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "external_tracking_results" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX "external_tracking_results_system_id_external_event_id_key"
  ON "external_tracking_results"("system_id", "external_event_id");
CREATE INDEX "external_tracking_results_workspace_id_group_id_occurred_at_idx"
  ON "external_tracking_results"("workspace_id", "group_id", "occurred_at");
CREATE INDEX "external_tracking_results_system_id_metric_type_occurred_at_idx"
  ON "external_tracking_results"("system_id", "metric_type", "occurred_at");
CREATE INDEX "external_tracking_results_external_tracking_link_id_occurred_at_idx"
  ON "external_tracking_results"("external_tracking_link_id", "occurred_at");
CREATE INDEX "external_tracking_results_member_identity_id_occurred_at_idx"
  ON "external_tracking_results"("member_identity_id", "occurred_at");

ALTER TABLE "external_tracking_results"
  ADD CONSTRAINT "external_tracking_results_system_id_fkey"
  FOREIGN KEY ("system_id") REFERENCES "external_tracking_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_tracking_results"
  ADD CONSTRAINT "external_tracking_results_external_tracking_link_id_fkey"
  FOREIGN KEY ("external_tracking_link_id") REFERENCES "external_tracking_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "external_tracking_results"
  ADD CONSTRAINT "external_tracking_results_member_identity_id_fkey"
  FOREIGN KEY ("member_identity_id") REFERENCES "external_tracking_member_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
