import type { Route } from 'next';
import GroupVideoAssetsPage from '../../../(app)/groups/[groupId]/video-assets/page';
import { resolveAuthenticatedMemberServicePage } from '../../../../src/services/member-service-page';

export const dynamic = 'force-dynamic';

export default async function ServiceVideoAssetsPage({
  params,
}: {
  params: Promise<{ serviceSlug: string }>;
}) {
  const { serviceSlug } = await params;
  const { service } = await resolveAuthenticatedMemberServicePage(
    serviceSlug,
    `/s/${serviceSlug}/video-assets` as Route,
  );
  return GroupVideoAssetsPage({
    params: Promise.resolve({ groupId: service.serviceId }),
    searchParams: Promise.resolve({ service: service.configuration.slug }),
  });
}
