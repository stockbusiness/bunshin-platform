import type { Route } from 'next';
import GroupVideoProjectPage from '../../../../(app)/groups/[groupId]/videos/[videoProjectId]/page';
import { resolveAuthenticatedMemberServicePage } from '../../../../../src/services/member-service-page';

export const dynamic = 'force-dynamic';

export default async function ServiceVideoProjectPage({
  params,
}: {
  params: Promise<{ serviceSlug: string; videoProjectId: string }>;
}) {
  const { serviceSlug, videoProjectId } = await params;
  const { service } = await resolveAuthenticatedMemberServicePage(
    serviceSlug,
    `/s/${serviceSlug}/videos/${videoProjectId}` as Route,
  );
  return GroupVideoProjectPage({
    params: Promise.resolve({ groupId: service.serviceId, videoProjectId }),
    searchParams: Promise.resolve({ service: service.configuration.slug }),
  });
}
