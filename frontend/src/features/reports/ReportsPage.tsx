import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { TASK_STATUS_LABELS, TASK_STATUSES } from '@/types/task';
import type { ReportGroupBy } from '@/types/report';
import { STATUS_TONES } from '@/utils/tone';
import { useProjects } from '@/features/projects/useProjects';
import { useReport } from './useReport';

/**
 * Relatorios agregados (D-015): por status ou por responsavel, com filtro
 * por projeto.
 */
export function ReportsPage() {
  const { projects } = useProjects();
  const [searchParams] = useSearchParams();
  const [groupBy, setGroupBy] = useState<ReportGroupBy>('status');
  const [projectId, setProjectId] = useState(searchParams.get('projectId') ?? '');
  const { report, loading, error } = useReport(groupBy, projectId);

  const total = report?.total ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Relatorios</h1>
        <p className="mt-1 text-sm text-slate-600">
          Totais de tarefas por status ou por responsavel.
        </p>
      </header>

      <Card>
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-sm text-slate-700" htmlFor="report-group-by">
              Agrupar por
            </label>
            <Select
              id="report-group-by"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as ReportGroupBy)}
              className="w-48"
            >
              <option value="status">Por status</option>
              <option value="user">Por responsavel</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700" htmlFor="report-project">
              Projeto
            </label>
            <Select
              id="report-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-64"
            >
              <option value="">Todos os meus projetos</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {loading && <p className="text-sm text-slate-600">Carregando relatorio...</p>}
      {error && <Alert>{error}</Alert>}

      {report && !loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card title="Total de tarefas">
              <p className="text-2xl font-semibold text-slate-900">{report.total}</p>
            </Card>
            {TASK_STATUSES.map((status) => (
              <Card key={status} title={TASK_STATUS_LABELS[status]}>
                <p className="text-2xl font-semibold text-slate-900">{report.byStatus[status] ?? 0}</p>
              </Card>
            ))}
          </div>

          <Card title={groupBy === 'status' ? 'Tarefas por status' : 'Tarefas por responsavel'}>
            {report.groups.length === 0 ? (
              <p className="text-sm text-slate-600">Nenhuma tarefa encontrada.</p>
            ) : (
              <ul className="space-y-2">
                {report.groups.map((group) => {
                  const percent = total === 0 ? 0 : Math.round((group.count / total) * 100);

                  return (
                    <li key={group.key}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-slate-800">
                          {groupBy === 'status' && (
                            <Badge tone={STATUS_TONES[group.key as keyof typeof STATUS_TONES]}>
                              {TASK_STATUS_LABELS[group.key as keyof typeof TASK_STATUS_LABELS]}
                            </Badge>
                          )}
                          {group.label}
                        </span>
                        <span className="text-slate-600">
                          {group.count} ({percent}%)
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded bg-slate-100">
                        <div
                          className="h-2 rounded bg-slate-900"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
