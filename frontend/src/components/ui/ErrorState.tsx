import { Alert } from './Alert';
import { Button } from './Button';

type ErrorStateProps = {
  message: string;
  /** Recarrega o que falhou. Sem ele nao ha botao. */
  onRetry?: () => void;
  /** Recarregando (enquanto o botao esta disponivel). */
  retrying?: boolean;
};

/** Erro de carregamento padrao: Alert + botao "Tentar novamente". */
export function ErrorState({ message, onRetry, retrying = false }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-start gap-3">
      <Alert>{message}</Alert>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} loading={retrying} loadingLabel="Carregando…">
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
