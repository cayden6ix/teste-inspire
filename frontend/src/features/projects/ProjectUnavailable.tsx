import { ButtonLink } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Page } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Skeleton';

/** Texto unico para 400/403/404 de projeto: inexistente e alheio sao indistinguiveis (D-027). */
export const PROJECT_UNAVAILABLE_MESSAGE = 'Projeto não encontrado ou você não tem acesso a ele.';

type ProjectUnavailableProps = {
  /** Mensagem do erro de carregamento do projeto (null enquanto carrega). */
  error: string | null;
  /** Erro passageiro (rede, 5xx): mostra "Tentar novamente"; senao "Voltar para projetos". */
  retryable: boolean;
  /** Recarregando depois de "Tentar novamente". */
  retrying: boolean;
  /** Recarrega TUDO o que a tela usa (projeto, papel e listas), nao so a lista (TRV-11). */
  onRetry: () => void;
};

/**
 * O que as telas de um projeto mostram enquanto o projeto (e o papel do usuario nele) nao
 * carregou: esqueleto ou erro. Nunca a tela "pela metade" (titulo vazio, modo somente leitura
 * por falta do papel).
 */
export function ProjectUnavailable({ error, retryable, retrying, onRetry }: ProjectUnavailableProps) {
  if (error) {
    return (
      <Page>
        {retryable ? (
          <ErrorState message={error} onRetry={onRetry} retrying={retrying} />
        ) : (
          <ErrorState
            message={PROJECT_UNAVAILABLE_MESSAGE}
            action={<ButtonLink to="/projects">Voltar para projetos</ButtonLink>}
          />
        )}
      </Page>
    );
  }

  return (
    <div role="status" aria-label="Carregando projeto…" className="flex flex-col gap-6">
      <span className="sr-only">Carregando projeto…</span>
      <div className="flex flex-col gap-3">
        <Skeleton className="w-1/3" />
        <Skeleton className="w-2/3" />
      </div>
      <Skeleton variant="control" className="w-full" />
      <Skeleton variant="card" className="w-full" />
    </div>
  );
}
