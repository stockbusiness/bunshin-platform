import { saveServiceSocialInsightResponse } from '../../../../../../../src/http/service-social-insights';

type Context = { params: Promise<{ serviceSlug: string; bunshinId: string }> };

export async function POST(request: Request, context: Context) {
  const { serviceSlug, bunshinId } = await context.params;
  return saveServiceSocialInsightResponse(request, serviceSlug, bunshinId);
}
