import { ingestExternalTrackingResultsResponse } from '../../../../../src/http/external-tracking-results';

type Context = { params: Promise<{ systemId: string }> };

export async function POST(request: Request, context: Context) {
  return ingestExternalTrackingResultsResponse(request, (await context.params).systemId);
}
