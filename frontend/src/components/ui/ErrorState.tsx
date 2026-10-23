import type { ReactNode } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';

type ErrorStateProps = {
  message: string;
  /** Recarrega o que falhou. Sem ele nao ha botao "Tentar novamente". */
  onRetry?: () => void;
  /** Recarregando (enquanto o botao esta disponivel). */
  retrying?: boolean;
  /** Acao no lugar do retry quando repetir nao resolve (ex.: "Voltar para projetos"). */
  action?: ReactNode;
};

/**
 * Erro de carregamento padrao: Alert + botao "Tentar novamente" (erros passageiros: rede, 5xx)
 * e/ou uma acao propria (erros definitivos: 400, 403, 404).
 */
export function ErrorState({ message, onRetry, retrying = false, action }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-start gap-3">
      <Alert>{message}</Alert>
      {(onRetry || action) && (
        <div className="flex flex-wrap items-center gap-3">
          {onRetry && (
            <Button variant="secondary" onClick={onRetry} loading={retrying} loadingLabel="Carregando…">
              Tentar novamente
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
