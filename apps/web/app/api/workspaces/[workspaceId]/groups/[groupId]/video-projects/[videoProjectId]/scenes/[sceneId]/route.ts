import { updateVideoSceneDraftResponse } from '../../../../../../../../../../src/http/video-projects';

type Context = {
  params: Promise<{
    workspaceId: string;
    groupId: string;
    videoProjectId: string;
    sceneId: string;
  }>;
};

export async function POST(request: Request, context: Context) {
  const { workspaceId, groupId, videoProjectId, sceneId } = await context.params;
  return updateVideoSceneDraftResponse(request, workspaceId, groupId, videoProjectId, sceneId);
}
