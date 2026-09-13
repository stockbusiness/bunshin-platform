import { ApplicationError, toApiError } from '@bunshin/shared';

type Context = { params: Promise<{ hostname: string }> };

export async function GET(request: Request, context: Context) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const hostname = (await context.params).hostname.trim().toLowerCase().replace(/\.$/, '');
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname))
      throw new ApplicationError('NOT_FOUND', 'custom domain not found');
    const db = await import('@bunshin/database');
    const now = new Date();
    const domain = await db.prisma.serviceCustomDomain.findFirst({
      where: {
        hostname,
        status: 'ACTIVE',
        configuration: {
          visibility: 'PUBLIC',
          group: { status: 'ACTIVE', workspace: { status: 'ACTIVE' } },
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          ],
        },
      },
      select: { configuration: { select: { slug: true } } },
    });
    if (!domain) throw new ApplicationError('NOT_FOUND', 'custom domain not found');
    return Response.json(
      { data: { slug: domain.configuration.slug }, requestId },
      { headers: { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  } catch (error) {
    const mapped = toApiError(error, requestId);
    return Response.json(mapped.body, {
      status: mapped.status,
      headers: { 'cache-control': 'public, s-maxage=30' },
    });
  }
}
