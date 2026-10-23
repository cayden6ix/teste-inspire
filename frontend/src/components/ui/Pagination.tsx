import type { PaginationMeta } from '@/types/pagination';
import { formatNumber } from '@/utils/format';
import { Button } from './Button';

type PaginationProps = {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

/**
 * Navegacao entre paginas de uma listagem. Nao aparece quando nao ha itens.
 * Fica ancorada abaixo da lista (rodape do DataTable). Usa o mesmo Button (40px) das demais telas.
 */
export function Pagination({ meta, onPageChange, disabled = false }: PaginationProps) {
  if (meta.total === 0) {
    return null;
  }

  const totalPages = Math.max(meta.totalPages, 1);
  const isFirst = meta.page <= 1;
  const isLast = meta.page >= totalPages;
  const single = totalPages <= 1;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-body text-slate-600"
    >
      <span>{`${from}-${to} de ${formatNumber(meta.total)}`}</span>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          iconOnly
          aria-label="Primeira página"
          title="Primeira página"
          disabled={disabled || single || isFirst}
          onClick={() => onPageChange(1)}
        >
          {'<<'}
        </Button>
        <Button
          variant="secondary"
          disabled={disabled || isFirst}
          onClick={() => onPageChange(meta.page - 1)}
        >
          Anterior
        </Button>
        <span className="min-w-32 text-center text-slate-800">{`Página ${meta.page} de ${totalPages}`}</span>
        <Button
          variant="secondary"
          disabled={disabled || isLast}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Próximo
        </Button>
        <Button
          variant="secondary"
          iconOnly
          aria-label="Última página"
          title="Última página"
          disabled={disabled || single || isLast}
          onClick={() => onPageChange(totalPages)}
        >
          {'>>'}
        </Button>
      </div>
    </nav>
  );
}
