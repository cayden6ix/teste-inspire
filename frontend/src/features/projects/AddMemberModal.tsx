import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Select } from '@/components/ui/Field';
import { FormModal } from '@/components/ui/FormModal';
import { PROJECT_ROLE_LABELS } from '@/types/project';
import type { ProjectRole } from '@/types/project';
import { useToast } from '@/stores/toastStore';
import { errorMessage } from '@/utils/errorMessage';
import { findUsers, USER_SEARCH_LIMIT } from '@/features/users/users.service';
import type { UserSummary } from '@/features/users/users.service';
import { addMember } from './projects.service';

/** O backend só lista usuários com no mínimo 3 caracteres (depois do trim) no e-mail. */
const MIN_SEARCH_LENGTH = 3;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AddMemberModalProps = {
  projectId: string;
  /** Papéis que o usuário logado pode atribuir (assignableRoles); nunca inclui owner. */
  roles: ProjectRole[];
  onClose: () => void;
  /** Chamado apos adicionar: a pagina recarrega a lista (o modal fecha sozinho, com a animacao de saida). */
  onAdded: () => void | Promise<void>;
};

/**
 * Modal 'Adicionar membro' (D-013): busca o usuario por e-mail (ou UUID), escolhe e
 * define o papel. Enter busca enquanto nao ha usuario selecionado e adiciona depois.
 * Monte-o so quando aberto.
 */
export function AddMemberModal({ projectId, roles, onClose, onAdded }: AddMemberModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  /** Total encontrado no servidor (a busca devolve no maximo 10 por vez, D-028). */
  const [found, setFound] = useState(0);
  const [selected, setSelected] = useState<UserSummary | null>(null);
  const [role, setRole] = useState<ProjectRole>(roles.includes('member') ? 'member' : (roles[0] ?? 'member'));
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const trimmed = query.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_SEARCH_LENGTH && !UUID_PATTERN.test(trimmed);

  async function search() {
    const value = query.trim();
    if (!value) return;

    setError(null);

    if (UUID_PATTERN.test(value)) {
      setSelected({ id: value, name: 'Usuário informado pelo UUID', email: '' });
      setResults([]);
      return;
    }

    // Abaixo do mínimo a API responderia 400: nem faz a requisição (a dica já está na tela).
    if (value.length < MIN_SEARCH_LENGTH) {
      setResults([]);
      return;
    }

    setSearching(true);

    try {
      const { data, meta } = await findUsers({ email: value, limit: USER_SEARCH_LIMIT });
      setResults(data);
      setFound(meta.total);

      if (data.length === 0) {
        setError('Nenhum usuário encontrado com esse e-mail.');
      }
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível buscar usuários.'));
    } finally {
      setSearching(false);
    }
  }

  async function add() {
    if (!selected) return;

    setError(null);
    setSaving(true);

    try {
      await addMember(projectId, { userId: selected.id, role });
      toast.success('Membro adicionado.');
      void onAdded();
      return true;
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível adicionar o membro.'));
      setSaving(false);
      return false;
    }
  }

  function changeUser() {
    setSelected(null);
    setResults([]);
    setError(null);
  }

  return (
    <FormModal
      title="Adicionar membro"
      description="Busque pelo e-mail cadastrado ou informe o UUID."
      onClose={onClose}
      onSubmit={selected ? add : search}
      submitLabel={selected ? 'Adicionar membro' : 'Buscar'}
      savingLabel={selected ? 'Adicionando…' : 'Buscando…'}
      saving={saving || searching}
      error={error}
    >
      {!selected ? (
        <>
          <FormField
            label="E-mail ou UUID"
            htmlFor="member-search"
            hint={tooShort ? `Digite ao menos ${MIN_SEARCH_LENGTH} caracteres do e-mail.` : undefined}
          >
            <Input
              id="member-search"
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="nome@email.com"
            />
          </FormField>

          {results.length > 0 && found > results.length && (
            <p className="text-caption text-slate-500">
              {`Mostrando ${results.length} de ${found} usuários. Digite mais do e-mail para refinar a busca.`}
            </p>
          )}

          {results.length > 0 && (
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-control border border-slate-200">
              {results.map((user) => (
                <li key={user.id} className="flex min-h-row items-center justify-between gap-3 px-compact py-2">
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium text-slate-900">{user.name}</p>
                    <p className="truncate text-caption text-slate-600">{user.email}</p>
                  </div>
                  <Button variant="secondary" onClick={() => setSelected(user)}>
                    Selecionar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="flex min-h-row items-center justify-between gap-3 rounded-control border border-slate-200 bg-slate-50 px-compact py-2">
            <div className="min-w-0">
              <p className="text-caption text-slate-600">Usuário selecionado</p>
              <p className="truncate text-body font-medium text-slate-900">
                {selected.name}
                {selected.email ? ` (${selected.email})` : ''}
              </p>
            </div>
            <Button variant="ghost" onClick={changeUser} disabled={saving}>
              Trocar
            </Button>
          </div>

          <FormField label="Papel" htmlFor="member-role">
            <Select id="member-role" value={role} onChange={(e) => setRole(e.target.value as ProjectRole)}>
              {roles.map((option) => (
                <option key={option} value={option}>
                  {PROJECT_ROLE_LABELS[option]}
                </option>
              ))}
            </Select>
          </FormField>
        </>
      )}
    </FormModal>
  );
}
