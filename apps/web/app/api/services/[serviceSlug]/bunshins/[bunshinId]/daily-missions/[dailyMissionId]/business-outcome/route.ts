import { recordServiceBusinessOutcomeResponse } from '../../../../../../../../../src/http/service-daily-missions';

type Context = {
  params: Promise<{ serviceSlug: string; bunshinId: string; dailyMissionId: string }>;
};

export async function POST(request: Request, context: Context) {
  const value = await context.params;
  return recordServiceBusinessOutcomeResponse(
    request,
    value.serviceSlug,
    value.bunshinId,
    value.dailyMissionId,
  );
}
