import GroupVideosPage from '../../../(app)/groups/[groupId]/videos/page';
import { resolveAuthenticatedMemberServicePage } from '../../../../src/services/member-service-page';

export const dynamic = 'force-dynamic';

export default async function ServiceVideosPage({
  params,
}: {
  params: Promise<{ serviceSlug: string }>;
}) {
  const { serviceSlug } = await params;
  const { service } = await resolveAuthenticatedMemberServicePage(
    serviceSlug,
    `/s/${serviceSlug}/videos`,
  );
  return GroupVideosPage({
    params: Promise.resolve({ groupId: service.serviceId }),
    searchParams: Promise.resolve({ service: service.configuration.slug }),
  });
}
