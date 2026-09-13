import { savedSocialPhotoResponse } from '../../../../../../../../../../src/http/social-images';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      workspaceId: string;
      groupId: string;
      bunshinId: string;
      photoId: string;
    }>;
  },
) {
  const params = await context.params;
  return savedSocialPhotoResponse(
    request,
    params.workspaceId,
    params.groupId,
    params.bunshinId,
    params.photoId,
  );
}
