CREATE TABLE "social_insight_snapshots" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "group_membership_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "bunshin_id" UUID NOT NULL,
    "social_profile_id" UUID NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "observed_on" DATE NOT NULL,
    "period_start" DATE,
    "period_end" DATE,
    "followers" INTEGER,
    "reach" INTEGER,
    "impressions" INTEGER,
    "profile_views" INTEGER,
    "interactions" INTEGER,
    "source" VARCHAR(24) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_insight_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "social_insight_snapshots_nonnegative_check" CHECK (
      ("followers" IS NULL OR "followers" >= 0) AND
      ("reach" IS NULL OR "reach" >= 0) AND
      ("impressions" IS NULL OR "impressions" >= 0) AND
      ("profile_views" IS NULL OR "profile_views" >= 0) AND
      ("interactions" IS NULL OR "interactions" >= 0)
    ),
    CONSTRAINT "social_insight_snapshots_period_check" CHECK (
      "period_start" IS NULL OR "period_end" IS NULL OR "period_start" <= "period_end"
    )
);

ALTER TABLE "social_insight_snapshots" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX "social_insight_snapshot_profile_day_key"
ON "social_insight_snapshots"("workspace_id", "bunshin_id", "social_profile_id", "observed_on");

CREATE INDEX "social_insight_snapshot_member_day_idx"
ON "social_insight_snapshots"("workspace_id", "group_id", "user_id", "observed_on");

CREATE INDEX "social_insight_snapshot_bunshin_day_idx"
ON "social_insight_snapshots"("workspace_id", "bunshin_id", "observed_on");

ALTER TABLE "social_insight_snapshots"
ADD CONSTRAINT "social_insight_snapshots_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "social_insight_snapshots"
ADD CONSTRAINT "social_insight_snapshots_workspace_id_group_id_fkey"
FOREIGN KEY ("workspace_id", "group_id") REFERENCES "groups"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "social_insight_snapshots"
ADD CONSTRAINT "social_insight_snapshots_membership_fkey"
FOREIGN KEY ("workspace_id", "group_id", "group_membership_id", "user_id")
REFERENCES "group_memberships"("workspace_id", "group_id", "id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "social_insight_snapshots"
ADD CONSTRAINT "social_insight_snapshots_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "social_insight_snapshots"
ADD CONSTRAINT "social_insight_snapshots_workspace_id_bunshin_id_fkey"
FOREIGN KEY ("workspace_id", "bunshin_id") REFERENCES "bunshins"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "social_insight_snapshots"
ADD CONSTRAINT "social_insight_snapshots_social_profile_fkey"
FOREIGN KEY ("workspace_id", "bunshin_id", "social_profile_id", "platform")
REFERENCES "social_profiles"("workspace_id", "bunshin_id", "id", "platform") ON DELETE CASCADE ON UPDATE CASCADE;
