import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Page } from '@/components/ui/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { ClearFilters, FilterSelect, Toolbar } from '@/components/ui/Toolbar';
import { MAX_PAGE_LIMIT } from '@/types/pagination';
import { TASK_STATUS_LABELS, TASK_STATUSES } from '@/types/task';
import type { ReportGroupBy } from '@/types/report';
import { formatNumber } from '@/utils/format';
import { STATUS_TONES } from '@/utils/tone';
import { useProjects } from '@/features/projects/useProjects';
import { useReport } from './useReport';

/**
 * Relatorios agregados (D-015): por status ou por responsavel, com filtro
 * por projeto.
 */
export function ReportsPage() {
  const { data: projects } = useProjects(MAX_PAGE_LIMIT);
  const [searchParams] = useSearchParams();
  const [groupBy, setGroupBy] = useState<ReportGroupBy>('status');
  const [projectId, setProjectId] = useState(searchParams.get('projectId') ?? '');
  const { report, loading, error, reload } = useReport(groupBy, projectId);

  const total = report?.total ?? 0;

  return (
    <Page>
      <PageHeader title="Relatórios" description="Totais de tarefas por status ou por responsável." />

      <Toolbar>
        <FilterSelect
          label="Agrupar por"
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as ReportGroupBy)}
        >
          <option value="status">Por status</option>
          <option value="user">Por responsável</option>
        </FilterSelect>
        <FilterSelect
          label="Projeto"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">Todos os meus projetos</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </FilterSelect>
        <ClearFilters
          active={projectId !== '' || groupBy !== 'status'}
          onClick={() => {
            setProjectId('');
            setGroupBy('status');
          }}
        />
      </Toolbar>

      {loading && (
        <div role="status" aria-label="Carregando relatório…" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <span className="sr-only">Carregando relatório…</span>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} variant="stat" className="w-full" />
          ))}
        </div>
      )}
      {error && <ErrorState message={error} onRetry={() => void reload()} retrying={loading} />}

      {report && !loading && (
        <div className="flex animate-fade-in flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card title="Total de tarefas">
              <p className="text-title font-semibold text-slate-900">{formatNumber(report.total)}</p>
            </Card>
            {TASK_STATUSES.map((status) => (
              <Card key={status} title={TASK_STATUS_LABELS[status]}>
                <p className="text-title font-semibold text-slate-900">{formatNumber(report.byStatus[status] ?? 0)}</p>
              </Card>
            ))}
          </div>

          <Card title={groupBy === 'status' ? 'Tarefas por status' : 'Tarefas por responsável'}>
            {report.groups.length === 0 ? (
              <p className="text-body text-slate-600">Nenhuma tarefa encontrada.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {report.groups.map((group) => {
                  const percent = total === 0 ? 0 : Math.round((group.count / total) * 100);

                  return (
                    <li key={group.key}>
                      <div className="flex items-center justify-between text-body">
                        <span className="flex items-center gap-2 text-slate-800">
                          {groupBy === 'status' ? (
                            <Badge tone={STATUS_TONES[group.key as keyof typeof STATUS_TONES]}>
                              {TASK_STATUS_LABELS[group.key as keyof typeof TASK_STATUS_LABELS]}
                            </Badge>
                          ) : (
                            group.label
                          )}
                        </span>
                        <span className="text-slate-600">
                          {formatNumber(group.count)} ({percent}%)
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-pill bg-slate-100">
                        <div
                          className="h-2 w-full origin-left animate-bar-grow rounded-pill bg-slate-900"
                          style={{ '--bar-scale': percent / 100 } as CSSProperties}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </Page>
  );
}
