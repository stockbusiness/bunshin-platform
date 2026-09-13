import { rotateExternalTrackingResultTokenResponse } from '../../../../../../../../src/http/external-tracking-results';

type Context = { params: Promise<{ workspaceId: string; systemId: string }> };

export async function POST(request: Request, context: Context) {
  const params = await context.params;
  return rotateExternalTrackingResultTokenResponse(request, params.workspaceId, params.systemId);
}
