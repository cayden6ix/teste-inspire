import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function HomePage() {
  const accessToken = useAuthStore((s) => s.accessToken);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">
        API de Gestao de Projetos e Tarefas
      </h1>
      <p className="text-sm text-slate-600">
        Organize o trabalho por projetos: cada tarefa pertence a um projeto, o acesso e
        controlado por papeis e os relatorios agregam o andamento por status ou responsavel.
      </p>

      {accessToken ? (
        <div className="flex gap-3">
          <Link
            to="/projects"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Projetos
          </Link>
          <Link
            to="/reports"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Relatorios
          </Link>
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          Entre para gerenciar seus projetos.{' '}
          <Link to="/login" className="text-slate-900 underline">
            Entrar
          </Link>
        </p>
      )}
    </div>
  );
}
