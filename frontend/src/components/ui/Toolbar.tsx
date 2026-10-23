import { useId, useRef } from 'react';
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

/**
 * Campo de busca com lupa. Enter aplica (quando `onSubmit`), Limpar zera e devolve o foco ao campo.
 *
 * A area a direita (selo "Enter" ou botao Limpar) so reserva espaco quando aparece: com o campo
 * vazio o placeholder usa a largura toda e aparece completo em qualquer tela (PRJ-08). A dica
 * "Pressione Enter para buscar" fica no `title` do selo e no `aria-describedby` do campo.
 */
export function SearchBox({
  value,
  onChange,
  placeholder,
  label,
  onSubmit,
  applied = '',
  onClear,
}: SearchBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const serverSearch = onSubmit !== undefined;
  const pending = serverSearch && value.trim() !== applied;
  const canClear = serverSearch ? applied !== '' : value !== '';

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit?.(value);
  }

  function handleClear() {
    onClear();
    // O botao Limpar some ao limpar: o foco volta ao campo, e nao ao <body> (PRJ-07).
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="group relative w-full sm:w-96">
      <SearchIcon />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        aria-describedby={serverSearch ? hintId : undefined}
        className={`pl-field-icon ${pending || canClear ? 'pr-field-action' : ''}`}
      />
      {serverSearch && (
        <span id={hintId} className="sr-only">
          Pressione Enter para buscar.
        </span>
      )}
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {pending ? (
          <kbd
            title="Pressione Enter para buscar"
            className="mr-2 rounded-control border border-slate-300 bg-slate-50 px-2 font-sans text-caption text-slate-500"
          >
            Enter
          </kbd>
        ) : (
          canClear && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
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
