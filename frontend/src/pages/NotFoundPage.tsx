import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Pagina nao encontrada</h1>
      <Link className="text-blue-600 underline" to="/">
        Voltar para o inicio
      </Link>
    </section>
  );
}
