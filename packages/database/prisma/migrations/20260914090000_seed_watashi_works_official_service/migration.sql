-- Create the first Watashi Works-operated business project under its own
-- organization. The public service stays private until legal documents and
-- the shared/dedicated LINE channel are verified by an operator.
DO $$
DECLARE
  operator_user_id UUID;
  organization_id UUID;
  project_id UUID;
  project_membership_id UUID;
  configuration_id UUID;
  existing_configuration_id UUID;
  existing_configuration_workspace_id UUID;
  existing_configuration_group_id UUID;
  existing_configuration_slug TEXT;
  configuration_created BOOLEAN := false;
BEGIN
  SELECT gm."user_id"
  INTO operator_user_id
  FROM "group_memberships" gm
  WHERE gm."group_id" = '452a3368-2a7d-4a17-92ae-822afffa8dcf'::UUID
    AND gm."status" = 'ACTIVE'
    AND gm."role" = 'MANAGER'
    AND gm."service_role" IN ('SERVICE_OWNER', 'SERVICE_ADMIN')
    AND EXISTS (
      SELECT 1
      FROM "auth_identities" ai
      WHERE ai."user_id" = gm."user_id"
        AND ai."provider" = 'LINE'
    )
  ORDER BY
    CASE gm."service_role" WHEN 'SERVICE_OWNER' THEN 0 ELSE 1 END,
    gm."created_at"
  LIMIT 1;

  IF operator_user_id IS NULL THEN
    RAISE NOTICE 'Watashi Works official service seed skipped: no Sennokuni LINE operator';
    RETURN;
  END IF;

  SELECT w."id"
  INTO organization_id
  FROM "workspaces" w
  WHERE w."type" = 'ORGANIZATION'
    AND w."name" = '運営団体ワタシワークス'
  ORDER BY w."created_at"
  LIMIT 1;

  IF organization_id IS NULL THEN
    organization_id := '74000000-0000-4000-8000-000000000001'::UUID;
    INSERT INTO "workspaces" (
      "id", "type", "name", "status", "description", "created_at", "updated_at"
    ) VALUES (
      organization_id,
      'ORGANIZATION',
      '運営団体ワタシワークス',
      'ACTIVE',
      'ワタシワークス公式プロジェクトを運営する団体',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  END IF;

  INSERT INTO "workspace_memberships" (
    "id", "workspace_id", "user_id", "role", "status", "created_at", "updated_at"
  ) VALUES (
    '74000000-0000-4000-8000-000000000002'::UUID,
    organization_id,
    operator_user_id,
    'OWNER',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("workspace_id", "user_id") DO UPDATE
  SET
    "role" = 'OWNER',
    "status" = 'ACTIVE',
    "updated_at" = CURRENT_TIMESTAMP;

  SELECT g."id"
  INTO project_id
  FROM "groups" g
  WHERE g."workspace_id" = organization_id
    AND g."name" = '企業向け'
  LIMIT 1;

  IF project_id IS NULL THEN
    project_id := '74000000-0000-4000-8000-000000000003'::UUID;
    INSERT INTO "groups" (
      "id", "workspace_id", "name", "status", "created_at", "updated_at"
    ) VALUES (
      project_id,
      organization_id,
      '企業向け',
      'ACTIVE',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  END IF;

  INSERT INTO "group_memberships" (
    "id", "workspace_id", "group_id", "user_id", "role", "service_role",
    "status","consented_at", "created_at", "updated_at"
  ) VALUES (
    '74000000-0000-4000-8000-000000000004'::UUID,
    organization_id,
    project_id,
    operator_user_id,
    'MANAGER',
    'SERVICE_OWNER',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("group_id", "user_id") DO UPDATE
  SET
    "workspace_id" = EXCLUDED."workspace_id",
    "role" = 'MANAGER',
    "service_role" = 'SERVICE_OWNER',
    "status" = 'ACTIVE',
    "consented_at" = COALESCE("group_memberships"."consented_at", CURRENT_TIMESTAMP),
    "declined_at" = NULL,
    "revoked_at" = NULL,
    "updated_at" = CURRENT_TIMESTAMP
  RETURNING "id" INTO project_membership_id;

  SELECT sc."id", sc."workspace_id", sc."group_id", sc."slug"
  INTO
    existing_configuration_id,
    existing_configuration_workspace_id,
    existing_configuration_group_id,
    existing_configuration_slug
  FROM "service_configurations" sc
  WHERE sc."slug" = 'watashi-works-official'
     OR sc."group_id" = project_id
  ORDER BY CASE WHEN sc."slug" = 'watashi-works-official' THEN 0 ELSE 1 END
  LIMIT 1;

  IF existing_configuration_id IS NOT NULL
    AND (
      existing_configuration_workspace_id <> organization_id
      OR existing_configuration_group_id <> project_id
      OR existing_configuration_slug <> 'watashi-works-official'
    )
  THEN
    RAISE EXCEPTION 'watashi-works-official conflicts with an existing project';
  END IF;

  IF existing_configuration_id IS NULL THEN
    configuration_id := '74000000-0000-4000-8000-000000000005'::UUID;
    configuration_created := true;
    INSERT INTO "service_configurations" (
      "id", "workspace_id", "group_id", "slug", "display_name", "description",
      "operator_name", "visibility", "powered_by_enabled", "trend_research_enabled",
      "point_issuance_stopped", "created_by_user_id", "updated_by_user_id",
      "created_at", "updated_at"
    ) VALUES (
      configuration_id,
      organization_id,
      project_id,
      'watashi-works-official',
      'ワタシワークス公式',
      '企業・店舗・個人事業主へ、毎日そのまま使えるSNS投稿文を届ける無料サービス',
      '運営団体ワタシワークス',
      'PRIVATE',
      true,
      true,
      false,
      operator_user_id,
      operator_user_id,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  ELSE
    configuration_id := existing_configuration_id;
  END IF;

  INSERT INTO "service_brands" (
    "id", "workspace_id", "group_id", "configuration_id", "primary_color",
    "secondary_color", "font_family", "created_at", "updated_at"
  ) VALUES (
    '74000000-0000-4000-8000-000000000006'::UUID,
    organization_id,
    project_id,
    configuration_id,
    '#0B356A',
    '#FF3B30',
    'system-ui',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("group_id") DO NOTHING;

  INSERT INTO "service_registration_policies" (
    "id", "workspace_id", "group_id", "configuration_id", "mode",
    "email_enabled", "line_enabled", "invite_code_enabled", "referral_enabled",
    "onboarding_config", "survey_config", "created_at", "updated_at"
  ) VALUES (
    '74000000-0000-4000-8000-000000000007'::UUID,
    organization_id,
    project_id,
    configuration_id,
    'PUBLIC',
    false,
    true,
    false,
    false,
    jsonb_build_object(
      'templateKey', 'BUSINESS_DAILY_IDEAS',
      'welcomeTitle', 'あなたの事業に合う投稿文をお届けします',
      'welcomeMessage', '業種や商品について教えてください。設定後は毎日LINEに、コピーして使える投稿文が届きます。',
      'businessProfileEnabled', true,
      'dailyIdeaDelivery', jsonb_build_object(
        'enabled', true,
        'cadence', 'DAILY',
        'defaultNotificationTime', '08:00',
        'lockCadence', true,
        'contentMode', 'READY_TO_USE',
        'mediaMode', 'TEXT_ONLY'
      )
    ),
    jsonb_build_object(
      'questions', jsonb_build_array('発信するときに大切にしたいことを教えてください。')
    ),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("group_id") DO NOTHING;

  INSERT INTO "service_commercial_settings" (
    "id", "workspace_id", "group_id", "configuration_id", "plan_name",
    "billing_mode", "status", "monthly_price_yen", "updated_by_user_id",
    "created_at", "updated_at"
  ) VALUES (
    '74000000-0000-4000-8000-000000000008'::UUID,
    organization_id,
    project_id,
    configuration_id,
    '無料プラン',
    'FREE',
    'ACTIVE',
    0,
    operator_user_id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("group_id") DO NOTHING;

  INSERT INTO "group_feature_policies" (
    "id", "workspace_id", "group_id", "feature_key", "status", "config",
    "set_by_user_id", "created_at", "updated_at"
  ) VALUES
    (
      '74000000-0000-4000-8000-000000000009'::UUID,
      organization_id,
      project_id,
      'SOCIAL',
      'ENABLED',
      '{}'::jsonb,
      operator_user_id,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    ),
    (
      '74000000-0000-4000-8000-000000000010'::UUID,
      organization_id,
      project_id,
      'LINE.DAILY_NOTIFICATION',
      'ENABLED',
      '{}'::jsonb,
      operator_user_id,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  ON CONFLICT ("group_id", "feature_key") DO NOTHING;

  INSERT INTO "group_member_feature_assignments" (
    "id", "workspace_id", "group_id", "group_membership_id", "feature_key",
    "status", "config", "assigned_by_user_id", "created_at", "updated_at"
  ) VALUES
    (
      '74000000-0000-4000-8000-000000000011'::UUID,
      organization_id,
      project_id,
      project_membership_id,
      'SOCIAL',
      'ENABLED',
      '{}'::jsonb,
      operator_user_id,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    ),
    (
      '74000000-0000-4000-8000-000000000012'::UUID,
      organization_id,
      project_id,
      project_membership_id,
      'LINE.DAILY_NOTIFICATION',
      'ENABLED',
      '{}'::jsonb,
      operator_user_id,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  ON CONFLICT ("group_membership_id", "feature_key") DO NOTHING;

  IF configuration_created THEN
    INSERT INTO "service_configuration_audits" (
      "id", "workspace_id", "group_id", "configuration_id", "action",
      "after_data", "reason", "performed_by_user_id", "occurred_at"
    ) VALUES (
      '74000000-0000-4000-8000-000000000013'::UUID,
      organization_id,
      project_id,
      configuration_id,
      'CREATED',
      jsonb_build_object(
        'slug', 'watashi-works-official',
        'displayName', 'ワタシワークス公式',
        'visibility', 'PRIVATE',
        'templateKey', 'BUSINESS_DAILY_IDEAS'
      ),
      '運営団体ワタシワークス配下へ企業向け公式プロジェクトを初期設定',
      operator_user_id,
      CURRENT_TIMESTAMP
    );
  END IF;
END $$;
