import { updateVideoNarrationSettingsResponse } from '../../../../../../../../../src/http/video-narration-settings';

type Context = {
  params: Promise<{ workspaceId: string; groupId: string; videoProjectId: string }>;
};

export async function POST(request: Request, context: Context) {
  const { workspaceId, groupId, videoProjectId } = await context.params;
  return updateVideoNarrationSettingsResponse(request, workspaceId, groupId, videoProjectId);
}
