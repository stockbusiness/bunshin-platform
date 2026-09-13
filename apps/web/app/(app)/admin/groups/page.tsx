import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { currentUserProvider } from '../../../../src/auth/current-user';
import { GroupAdminEditor } from './group-admin-editor';

export const dynamic = 'force-dynamic';

export default async function GroupAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string; createdOrganization?: string }>;
}) {
  const user = await (await currentUserProvider()).getCurrentUser();
  if (!user) redirect('/login');
  const db = await import('@bunshin/database');
  const platformAdmin =
    await new db.PrismaPlatformAdminRepository().findActivePlatformAdminByUserId(user.userId);
  if (!platformAdmin) notFound();

  const workspaces = await db.prisma.workspace.findMany({
    where: {
      status: 'ACTIVE',
      type: 'ORGANIZATION',
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const query = await searchParams;
  const requested = query.workspaceId;
  const workspace = workspaces.find((item) => item.id === requested) ?? workspaces[0];

  if (!workspace)
    return (
      <main className="app-page">
        <h1>プロジェクト管理</h1>
        <p>登録されている運営団体がありません。</p>
        <p>プロジェクトを作る前に、運営団体を作成してください。</p>
        <Link className="button" href="/admin/organizations">
          運営団体を作成する
        </Link>
      </main>
    );

  const groups = await db.prisma.group.findMany({
    where: { workspaceId: workspace.id },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      _count: { select: { memberships: true, productPacks: true, campaigns: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <main className="app-page">
      <header className="app-page__heading">
        <p className="eyebrow">ワタシワークス全体・システム管理</p>
        <h1>プロジェクト管理</h1>
        <p>必ず運営団体を選び、その団体の中にプロジェクトを作成します。</p>
      </header>
      {query.createdOrganization === '1' ? (
        <p className="notice notice--success">
          運営団体を作成しました。次に、この団体のプロジェクトを作成してください。
        </p>
      ) : null}
      <section className="settings-card">
        <h2>プロジェクトを作った後にすること</h2>
        <ol>
          <li>所属する運営団体を選び、プロジェクト名を入力して作成します。</li>
          <li>「使える機能を設定」で、利用を許可する機能と上限を決めます。</li>
          <li>「参加者と管理者を設定」で、運営する人と利用する人を追加します。</li>
          <li>必要に応じて商品情報・公式情報・専用LINEを設定し、参加者へ案内します。</li>
        </ol>
      </section>
      <form method="get" className="settings-card">
        <label>
          プロジェクトを置く運営団体
          <select name="workspaceId" defaultValue={workspace.id}>
            {workspaces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>{' '}
        <button type="submit">切り替える</button>
      </form>
      <GroupAdminEditor workspaceId={workspace.id} />
      <section className="settings-card" aria-labelledby="saved-groups-title">
        <h2 id="saved-groups-title">{workspace.name} のプロジェクト</h2>
        {groups.length === 0 ? (
          <p>まだプロジェクトはありません。上の入力欄から最初のプロジェクトを作成してください。</p>
        ) : (
          <ul>
            {groups.map((group) => (
              <li key={group.id}>
                <strong>{group.name}</strong> — 状態：{group.status}／参加者：
                {group._count.memberships}人／商品：{group._count.productPacks}件／募集：
                {group._count.campaigns}件<br />
                <Link href={`/admin/groups/${group.id}/features`}>使える機能を設定</Link> ／{' '}
                <Link href={`/admin/groups/${group.id}/line` as Route}>専用LINEを設定</Link> ／{' '}
                <Link href={`/groups/${group.id}/members`}>参加者と管理者を設定</Link> ／{' '}
                <Link href={`/groups/${group.id}/badges`}>バッジを設定</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
