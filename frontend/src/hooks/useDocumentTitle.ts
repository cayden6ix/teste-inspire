import { useEffect } from 'react';

export const APP_TITLE = 'Gestão de Projetos e Tarefas';

/**
 * Titulo da aba: `Projetos · Gestão de Projetos e Tarefas`. Sem titulo de pagina, so o nome
 * da aplicacao. Espacos extras sao removidos (nomes de projeto vem do usuario).
 */
export function formatDocumentTitle(pageTitle?: string | null): string {
  const page = pageTitle?.replace(/\s+/g, ' ').trim();
  return page ? `${page} · ${APP_TITLE}` : APP_TITLE;
}

/**
 * Atualiza o `<title>` a cada rota (TRV-25), para leitores de tela, historico e abas.
 * O texto comeca pelo mesmo `h1` que o `PageTransition` anuncia (ex.: "Tarefas — Portal").
 */
export function useDocumentTitle(pageTitle?: string | null): void {
  useEffect(() => {
    document.title = formatDocumentTitle(pageTitle);
  }, [pageTitle]);
}
