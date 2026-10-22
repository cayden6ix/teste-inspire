import { useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Field';
import { PROJECT_ROLE_LABELS, assignableRoles } from '@/types/project';
import type { ProjectRole } from '@/types/project';
import { errorMessage } from '@/utils/errorMessage';
import { ROLE_TONES } from '@/utils/tone';
import { findUsers } from '@/features/users/users.service';
import type { UserSummary } from '@/features/users/users.service';
import { addMember, removeMember, updateMemberRole } from './projects.service';
import { useMembers } from './useMembers';
import { useProject } from './useProject';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Membros do projeto e seus papeis (D-013).
 */
export function ProjectMembersPage() {
  const { projectId } = useParams();
  const { project } = useProject(projectId);
  const { members, loading, error, reload } = useMembers(projectId);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  const [selected, setSelected] = useState<UserSummary | null>(null);
  const [role, setRole] = useState<ProjectRole>('member');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canManage = project?.role === 'owner' || project?.role === 'admin';
  const roles = project ? assignableRoles(project.role) : (['member'] as ProjectRole[]);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();

    const value = query.trim();
    if (!value) return;

    setFormError(null);

    if (UUID_PATTERN.test(value)) {
      setSelected({ id: value, name: 'Usuario informado pelo UUID', email: '' });
      setResults([]);
      return;
    }

    setBusy(true);

    try {
      const found = await findUsers(value);
      setResults(found);

      if (found.length === 0) {
        setFormError('Nenhum usuario encontrado com esse e-mail.');
      }
    } catch (err) {
      setFormError(errorMessage(err, 'Nao foi possivel buscar usuarios.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!projectId || !selected) return;

    setFormError(null);
    setBusy(true);

    try {
      await addMember(projectId, { userId: selected.id, role });
      setSelected(null);
      setQuery('');
      setResults([]);
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'Nao foi possivel adicionar o membro.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(memberUserId: string, nextRole: ProjectRole) {
    if (!projectId) return;

    setFormError(null);

    try {
      await updateMemberRole(projectId, memberUserId, nextRole);
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'Nao foi possivel alterar o papel.'));
    }
  }

  async function handleRemove(memberUserId: string, memberName: string) {
    if (!projectId) return;
    if (!window.confirm(`Remover ${memberName} do projeto?`)) {
      return;
    }

    setFormError(null);

    try {
      await removeMember(projectId, memberUserId);
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'Nao foi possivel remover o membro.'));
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Membros</h1>
        <p className="mt-1 text-sm text-slate-600">
          {project ? `Projeto ${project.name}` : 'Projeto'} - papeis owner, admin, member e viewer.
        </p>
      </header>

      {formError && <Alert>{formError}</Alert>}

      {canManage && (
        <Card title="Adicionar membro" description="Busque pelo e-mail cadastrado ou informe o UUID.">
          <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <label className="mb-1 block text-sm text-slate-700" htmlFor="member-search">
                E-mail ou UUID
              </label>
              <Input
                id="member-search"
                required
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="usuario@email.com"
              />
            </div>
            <Button type="submit" variant="secondary" disabled={busy}>
              {busy ? 'Buscando...' : 'Buscar'}
            </Button>
          </form>

          {results.length > 0 && !selected && (
            <ul className="mt-4 divide-y divide-slate-200">
              {results.map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-4 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-600">{user.email}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setSelected(user)}>
                    Selecionar
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {selected && (
            <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-64 flex-1">
                <p className="text-sm text-slate-700">Usuario selecionado</p>
                <p className="text-sm font-medium text-slate-900">
                  {selected.name}
                  {selected.email ? ` (${selected.email})` : ''}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700" htmlFor="member-role">
                  Papel
                </label>
                <Select
                  id="member-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as ProjectRole)}
                  className="w-40"
                >
                  {roles.map((option) => (
                    <option key={option} value={option}>
                      {PROJECT_ROLE_LABELS[option]}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? 'Adicionando...' : 'Adicionar membro'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSelected(null);
                  setResults([]);
                }}
              >
                Trocar
              </Button>
            </form>
          )}
        </Card>
      )}

      <Card title="Membros do projeto">
        {loading && <p className="text-sm text-slate-600">Carregando membros...</p>}
        {error && <Alert>{error}</Alert>}
        {!loading && !error && members.length === 0 && (
          <p className="text-sm text-slate-600">Nenhum membro encontrado.</p>
        )}

        {members.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Nome</th>
                <th className="py-2">E-mail</th>
                <th className="py-2">Papel</th>
                <th className="py-2 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="py-2 font-medium text-slate-900">{member.name}</td>
                  <td className="py-2 text-slate-600">{member.email}</td>
                  <td className="py-2">
                    {canManage ? (
                      <Select
                        value={member.role}
                        onChange={(e) => void handleRoleChange(member.userId, e.target.value as ProjectRole)}
                        className="w-36"
                      >
                        {roles.map((option) => (
                          <option key={option} value={option}>
                            {PROJECT_ROLE_LABELS[option]}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Badge tone={ROLE_TONES[member.role]}>{PROJECT_ROLE_LABELS[member.role]}</Badge>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {canManage && member.role !== 'owner' && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => void handleRemove(member.userId, member.name)}
                      >
                        Remover
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
