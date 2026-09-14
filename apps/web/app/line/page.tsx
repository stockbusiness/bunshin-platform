import { redirect } from 'next/navigation';
import { currentUserProvider } from '../../src/auth/current-user';

export const dynamic = 'force-dynamic';

/** LINE Developers / LIFF から開く共通入口。 */
export default async function LineEntryPage() {
  const user = await (await currentUserProvider()).getCurrentUser();
  redirect(user ? '/bunshins' : '/login');
}
