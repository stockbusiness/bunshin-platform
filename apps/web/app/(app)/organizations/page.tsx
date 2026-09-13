import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUserProvider } from '../../../src/auth/current-user';

export const dynamic = 'force-dynamic';

const organizationRoleLabel = {
  OWNER: '団体所有者',
  ADMIN: '団体運営者',
  MEMBER: '団体参加者',
} as const;

type Project = {
  id: string;
  name: string;
  serviceConfiguration: { slug: string; displayName: string } | null;
};

type OrganizationAccess = {
  id: string;
  name: string;
  description: string | null;
  accessLabel: string;
  canManageOrganization: boolean;
  projects: Project[];
};

export default async function OrganizationsPage() {
  const actor = await (await currentUserProvider()).getCurrentUser();
  if (!actor) redirect('/login');
  const db = await import('@bunshin/database');
  const [organizationMemberships, managedProjectMemberships] = await Promise.all([
    db.prisma.workspaceMembership.findMany({
      where: {
        userId: actor.userId,
        status: 'ACTIVE',
        role: { in: ['OWNER', 'ADMIN'] },
        workspace: { type: 'ORGANIZATION', status: 'ACTIVE' },
      },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            name: true,
            description: true,
            groups: {
              where: { status: 'ACTIVE' },
              select: {
                id: true,
                name: true,
                serviceConfiguration: { select: { slug: true, displayName: true } },
              },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
      orderBy: { workspace: { name: 'asc' } },
    }),
    db.prisma.groupMembership.findMany({
      where: {
        userId: actor.userId,
        status: 'ACTIVE',
        OR: [{ role: 'MANAGER' }, { serviceRole: { in: ['SERVICE_OWNER', 'SERVICE_ADMIN'] } }],
        group: {
          status: 'ACTIVE',
          workspace: { type: 'ORGANIZATION', status: 'ACTIVE' },
        },
      },
      select: {
        group: {
          select: {
            id: true,
            name: true,
            serviceConfiguration: { select: { slug: true, displayName: true } },
            workspace: { select: { id: true, name: true, description: true } },
          },
        },
      },
      orderBy: [{ group: { workspace: { name: 'asc' } } }, { group: { name: 'asc' } }],
    }),
  ]);

  const organizations = new Map<string, OrganizationAccess>();
  for (const membership of organizationMemberships) {
    organizations.set(membership.workspace.id, {
      id: membership.workspace.id,
      name: membership.workspace.name,
      description: membership.workspace.description,
      accessLabel: organizationRoleLabel[membership.role],
      canManageOrganization: true,
      projects: membership.workspace.groups,
    });
  }
  for (const membership of managedProjectMemberships) {
    const { workspace, ...project } = membership.group;
    const existing = organizations.get(workspace.id);
    if (existing?.canManageOrganization) continue;
    if (existing) {
      if (!existing.projects.some((item) => item.id === project.id))
        existing.projects.push(project);
      continue;
    }
    organizations.set(workspace.id, {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      accessLabel: 'プロジェクト運営者',
      canManageOrganization: false,
      projects: [project],
    });
  }

  const visibleOrganizations = [...organizations.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'ja'),
  );

  return (
    <main className="app-page">
      <header className="app-page__heading">
        <p className="eyebrow">運営者メニュー</p>
        <h1>運営団体とプロジェクト</h1>
        <p>各プロジェクトは、必ず運営団体の中に置かれます。</p>
      </header>

      {visibleOrganizations.length === 0 ? (
        <section className="settings-card">
          <h2>管理できる運営団体・プロジェクトはありません</h2>
          <p>運営団体またはプロジェクトの管理者から、招待を送ってもらってください。</p>
          <Link className="button button--secondary" href="/groups">
            参加中のプロジェクトを見る
          </Link>
        </section>
      ) : (
        visibleOrganizations.map((organization) => (
          <section className="settings-card" key={organization.id}>
            <div className="management-section__heading">
              <div>
                <p className="management-section__eyebrow">{organization.accessLabel}</p>
                <h2>{organization.name}</h2>
              </div>
              <span>{organization.projects.length}プロジェクト</span>
            </div>
            {organization.description ? <p>{organization.description}</p> : null}
            {organization.canManageOrganization ? (
              <div className="button-row">
                <Link className="button" href={`/organizations/${organization.id}/manage`}>
                  団体情報・運営者を管理
                </Link>
              </div>
            ) : null}

            <h3>この運営団体のプロジェクト</h3>
            {organization.projects.length === 0 ? (
              <p>まだプロジェクトはありません。団体管理画面から作成できます。</p>
            ) : (
              <ul className="organization-group-list">
                {organization.projects.map((project) => (
                  <li key={project.id}>
                    <div>
                      <strong>{project.serviceConfiguration?.displayName ?? project.name}</strong>
                      {project.serviceConfiguration &&
                      project.serviceConfiguration.displayName !== project.name ? (
                        <span>管理名：{project.name}</span>
                      ) : null}
                    </div>
                    <div className="button-row">
                      {project.serviceConfiguration ? (
                        <Link
                          className="button button--secondary"
                          href={`/s/${project.serviceConfiguration.slug}/manage`}
                        >
                          プロジェクトを管理
                        </Link>
                      ) : null}
                      <Link
                        className="button button--secondary"
                        href={`/groups/${project.id}/members`}
                      >
                        参加者・機能を管理
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </main>
  );
}
