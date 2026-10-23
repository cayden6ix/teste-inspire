import type { CSSProperties, ReactNode } from 'react';
import { DEFAULT_PAGE_LIMIT } from '@/types/pagination';
import type { PaginationMeta } from '@/types/pagination';
import type { RowState } from '@/hooks/useRowStates';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Pagination } from './Pagination';
import { Skeleton } from './Skeleton';

const SKELETON_ROWS = 8;
/** So as primeiras 15 linhas escalonam a entrada: atraso total <= 14 * 8ms = 112ms. */
const MAX_STAGGER_ROWS = 15;

export type DataColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Classe de largura da coluna em md+ (ex.: `md:w-32`). A coluna sem largura ocupa o resto. */
  width?: string;
  align?: 'left' | 'right';
  /** Coluna principal: ocupa a linha inteira no layout empilhado (< md). */
  primary?: boolean;
  /** Em < md cada celula mostra o cabecalho como rotulo; desligue para botoes de acao. */
  mobileLabel?: boolean;
};

type DataTableProps<T> = {
  /** Nome acessivel da tabela. */
  label: string;
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading: boolean;
  error?: string | null;
  /** Habilita o botao "Tentar novamente" no estado de erro. */
  onRetry?: () => void;
  /** Estado de uma linha: `saving`/`deleting` (aria-busy) ou `removing` (animacao de saida). */
  rowState?: (row: T) => RowState | undefined;
  loadingLabel: string;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  pagination?: { meta: PaginationMeta; onPageChange: (page: number) => void };
  /** Tamanho de pagina: define a altura minima do conteiner para o layout nao pular. */
  pageSize?: number;
};

/**
 * Listagem padrao (projetos, tarefas e membros): mesma altura de linha, mesmo cabecalho,
 * mesmos estados vazio/carregando e paginacao sempre ancorada abaixo da lista.
 * Em telas estreitas cada linha vira um cartao empilhado, sem scroll horizontal.
 */
export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  rowState,
  loadingLabel,
  emptyTitle,
  emptyDescription,
  emptyAction,
  pagination,
  pageSize = DEFAULT_PAGE_LIMIT,
}: DataTableProps<T>) {
  /** Altura minima = cabecalho + pagina cheia de linhas, derivada dos tokens `--spacing-*`. */
  const minHeight = {
    '--list-min-h': `calc(var(--spacing-table-head) + ${pageSize} * var(--spacing-row))`,
  } as CSSProperties;
  const hasRows = rows.length > 0;
  const showPagination = pagination !== undefined && pagination.meta.total > 0;

  return (
    <section
      aria-label={label}
      className="flex flex-col overflow-hidden rounded-surface border border-slate-200 bg-white"
    >
      <div style={minHeight} className="min-h-60 flex-1 md:min-h-(--list-min-h)">
        {error && (
          <div className="p-compact">
            <ErrorState message={error} onRetry={onRetry} retrying={loading} />
          </div>
        )}

        {!error && loading && !hasRows && (
          <div role="status" aria-label={loadingLabel}>
            <span className="sr-only">{loadingLabel}</span>
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <div
                key={index}
                className="flex h-row items-center gap-4 border-b border-slate-100 px-compact"
              >
                <Skeleton className="w-2/5" />
                <Skeleton className="hidden w-1/6 sm:block" />
                <Skeleton className="ml-auto w-16" />
              </div>
            ))}
          </div>
        )}

        {!error && !loading && !hasRows && (
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        )}

        {hasRows && (
          <table
            aria-busy={loading}
            className={`w-full text-left text-body transition-opacity max-md:block md:table-fixed ${
              loading ? 'opacity-60' : ''
            }`}
          >
            <thead className="bg-slate-50 max-md:sr-only">
              <tr className="border-b border-slate-200 md:h-table-head">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`px-compact text-caption font-semibold uppercase tracking-wide text-slate-500 ${
                      column.align === 'right' ? 'md:text-right' : ''
                    } ${column.width ?? ''}`}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 max-md:block">
              {rows.map((row, index) => {
                const state = rowState?.(row);

                return (
                  <tr
                    key={rowKey(row)}
                    style={{ '--row-index': Math.min(index, MAX_STAGGER_ROWS - 1) } as CSSProperties}
                    aria-busy={state === 'saving' || state === 'deleting' || undefined}
                    className={`transition-colors hover:bg-slate-50/70 ${
                      state === 'removing' ? 'pointer-events-none animate-row-out' : 'animate-row-in'
                    } max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-4 max-md:gap-y-2 max-md:px-compact max-md:py-3 md:h-row`}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        data-label={column.mobileLabel === false ? undefined : column.header}
                        className={`max-md:block md:px-compact md:py-0 md:align-middle ${
                          column.primary ? 'max-md:min-w-0 max-md:basis-full' : ''
                        } ${column.align === 'right' ? 'md:text-right max-md:ml-auto' : ''} ${
                          column.mobileLabel === false
                            ? ''
                            : 'max-md:before:mr-2 max-md:before:text-caption max-md:before:font-medium max-md:before:text-slate-400 max-md:before:content-[attr(data-label)]'
                        }`}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showPagination && (
        <div className="border-t border-slate-200 bg-slate-50/60 p-compact">
          <Pagination meta={pagination.meta} onPageChange={pagination.onPageChange} disabled={loading} />
        </div>
      )}
    </section>
  );
}
