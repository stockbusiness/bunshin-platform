import { authorizeVideoPostCopy } from '../../../../src/http/video-line-access';

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  return authorizeVideoPostCopy(request, (await context.params).projectId);
}
