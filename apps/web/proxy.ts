import { type NextRequest, NextResponse } from 'next/server';

function hostnameFromRequest(request: NextRequest) {
  return (request.headers.get('host') ?? '').split(':')[0]!.trim().toLowerCase().replace(/\.$/, '');
}

export async function proxy(request: NextRequest) {
  const hostname = hostnameFromRequest(request);
  const canonicalHostname = process.env.APP_URL ? new URL(process.env.APP_URL).hostname : '';
  if (
    !hostname ||
    hostname === canonicalHostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.vercel.app')
  )
    return NextResponse.next();

  const lookupUrl = new URL(
    `/api/public/custom-domains/${encodeURIComponent(hostname)}`,
    request.url,
  );
  const resolution = await fetch(lookupUrl, {
    headers: { 'x-request-id': request.headers.get('x-request-id') ?? crypto.randomUUID() },
    next: { revalidate: 60 },
  });
  if (!resolution.ok) return NextResponse.next();
  const payload = (await resolution.json()) as { data?: { slug?: string } };
  if (!payload.data?.slug) return NextResponse.next();
  const destination = request.nextUrl.clone();
  destination.pathname = `/s/${payload.data.slug}`;
  return NextResponse.rewrite(destination);
}

export const config = { matcher: ['/'] };
