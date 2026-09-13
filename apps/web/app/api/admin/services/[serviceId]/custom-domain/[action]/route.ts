import { ApplicationError } from '@bunshin/shared';
import { transitionServiceCustomDomainResponse } from '../../../../../../../src/http/services';

type Context = { params: Promise<{ serviceId: string; action: string }> };

export async function POST(request: Request, context: Context) {
  const { serviceId, action } = await context.params;
  if (action !== 'connect' && action !== 'verify' && action !== 'disconnect')
    throw new ApplicationError('NOT_FOUND', 'route unavailable');
  return transitionServiceCustomDomainResponse(request, serviceId, action);
}
