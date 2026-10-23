import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Botoes de acao (o primario por ultimo) e abas, alinhados a direita. */
  actions?: ReactNode;
};

/** Cabecalho de pagina: titulo (text-title) + descricao (com medida de leitura) + acoes. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-4">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-3 text-title font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-2 max-w-prose text-body text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
