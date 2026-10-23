import { Link } from 'react-router-dom';
import type { LinkProps } from 'react-router-dom';
import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

/**
 * Tamanho do botao. `md` (40px) e o unico padrao de toda a aplicacao. `sm` (32px) existe so
 * para a acao embutida dentro de um campo (ex.: Limpar da busca); nao use em paginas.
 */
export type ButtonSize = 'md' | 'sm';

const BASE =
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control border text-body font-medium transition disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-slate-900 text-white hover:bg-slate-700 active:bg-slate-800',
  secondary: 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100',
  danger: 'border-red-300 bg-white text-red-700 hover:bg-red-50 active:bg-red-100',
  ghost: 'border-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'h-control',
  sm: 'h-control-sm',
};

const WIDTHS: Record<ButtonSize, { text: string; icon: string }> = {
  md: { text: 'min-w-button px-4', icon: 'w-control px-0' },
  sm: { text: 'px-3', icon: 'w-control-sm px-0' },
};

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Botao so-icone (ou so simbolo): quadrado, com a mesma altura dos demais. */
  iconOnly?: boolean;
  className?: string;
};

/** Classes do botao: use em links/NavLink com aparencia de botao para manter o mesmo tamanho. */
export function buttonClass({
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  className = '',
}: ButtonStyleOptions = {}) {
  const width = iconOnly ? WIDTHS[size].icon : WIDTHS[size].text;
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${width} ${className}`.trim();
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonStyleOptions & {
    /**
     * Requisicao em andamento: spinner centralizado no lugar do texto, botao desabilitado (anti duplo
     * clique) e `aria-busy`. O rotulo fica invisivel mas continua ocupando espaco, entao a largura e a
     * altura sao SEMPRE as do repouso. Passe sempre um booleano (nao `undefined`) em botoes de acao.
     */
    loading?: boolean;
    /** Texto de andamento (ex.: `Salvando…`): vai para um `role="status"` sr-only e para o `title`. */
    loadingLabel?: string;
  };

export function Button({
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  className = '',
  type = 'button',
  loading,
  loadingLabel,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const supportsLoading = loading !== undefined;
  const busy = loading === true;

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      title={busy && loadingLabel ? loadingLabel : props.title}
      className={buttonClass({ variant, size, iconOnly, className: `${supportsLoading ? 'relative' : ''} ${className}` })}
    >
      {supportsLoading ? (
        <>
          {/* O rotulo continua ocupando o mesmo espaco (so fica invisivel): a largura e sempre a do repouso. */}
          <span className={`inline-flex items-center justify-center gap-2 ${busy ? 'invisible' : ''}`}>
            {children}
          </span>
          {busy && (
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </span>
          )}
          {/* Texto de andamento so para leitores de tela (e no `title`). */}
          <span role="status" className="sr-only">
            {busy ? loadingLabel : ''}
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

type ButtonLinkProps = LinkProps & ButtonStyleOptions;

/** Link de navegacao (react-router) com a aparencia e o tamanho de um Button. */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  iconOnly = false,
  className = '',
  ...props
}: ButtonLinkProps) {
  return <Link {...props} className={buttonClass({ variant, size, iconOnly, className })} />;
}
