import { previewVideoNarrationResponse } from '../../../../../../../src/http/video-narration-preview';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string; groupId: string }> },
) {
  const { workspaceId, groupId } = await context.params;
  return previewVideoNarrationResponse(request, workspaceId, groupId);
}
