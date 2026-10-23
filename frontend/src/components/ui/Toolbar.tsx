import type { FormEvent, ReactNode, SelectHTMLAttributes } from 'react';
import { formatNumber } from '@/utils/format';
import { Button } from './Button';
import { Input, Select } from './Field';

type ToolbarProps = {
  children: ReactNode;
};

/**
 * Barra de ferramentas horizontal dos filtros: em telas largas os controles ficam lado a
 * lado (com quebra de linha), em telas estreitas empilham. Todos os controles tem 40px.
 */
export function Toolbar({ children }: ToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-surface border border-slate-200 bg-white p-compact sm:flex-row sm:flex-wrap sm:items-center">
      {children}
    </div>
  );
}

type ResultCountProps = {
  count: number;
  loading?: boolean;
};

/** Contagem de resultados, alinhada a direita da barra. */
export function ResultCount({ count, loading = false }: ResultCountProps) {
  return (
    <span
      aria-live="polite"
      className={`whitespace-nowrap text-body text-slate-600 sm:ml-auto ${loading ? 'opacity-60' : ''}`}
    >
      {`${formatNumber(count)} ${count === 1 ? 'item' : 'itens'}`}
    </span>
  );
}

type SearchBoxProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  /** Busca por Enter (servidor). Sem isto, a busca e viva: so `onChange` age. */
  onSubmit?: (value: string) => void;
  /** Termo ja aplicado no servidor; habilita o botao Limpar e a dica de Enter. */
  applied?: string;
  onClear: () => void;
};

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-slate-700"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.5 13.5L17 17" />
    </svg>
  );
}

/** Campo de busca com lupa. Enter aplica (quando `onSubmit`), Limpar zera. */
export function SearchBox({
  value,
  onChange,
  placeholder,
  label,
  onSubmit,
  applied = '',
  onClear,
}: SearchBoxProps) {
  const serverSearch = onSubmit !== undefined;
  const pending = serverSearch && value.trim() !== applied;
  const canClear = serverSearch ? applied !== '' : value !== '';

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit?.(value);
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="group relative w-full sm:w-96">
      <SearchIcon />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="pl-field-icon pr-field-action sm:pr-field-hint"
      />
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {pending ? (
          <span className="pr-2 text-caption text-slate-500">
            <span className="sm:hidden">Enter</span>
            <span className="hidden sm:inline">Pressione Enter para buscar</span>
          </span>
        ) : (
          canClear && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Limpar
            </Button>
          )
        )}
      </div>
    </form>
  );
}

type FilterSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Rotulo visivel ao lado do select; sem ele, use `aria-label`. */
  label?: string;
};

/** Select da barra de filtros: mesma altura (40px) e largura em todas as telas. */
export function FilterSelect({ label, className = '', ...props }: FilterSelectProps) {
  const select = <Select {...props} className={`sm:w-56 ${className}`} />;

  if (!label) {
    return select;
  }

  return (
    <label className="flex flex-col gap-2 text-label text-slate-600 sm:flex-row sm:items-center">
      <span className="whitespace-nowrap">{label}</span>
      {select}
    </label>
  );
}

type ClearFiltersProps = {
  active: boolean;
  onClick: () => void;
};

/** Aparece so quando ha algum filtro ativo. */
export function ClearFilters({ active, onClick }: ClearFiltersProps) {
  if (!active) {
    return null;
  }

  return (
    <Button variant="ghost" onClick={onClick}>
      Limpar filtros
    </Button>
  );
}
