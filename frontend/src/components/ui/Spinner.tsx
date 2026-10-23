type SpinnerSize = 'sm' | 'lg';

/** Tamanhos dos tokens `--spacing-spinner` (16px: botoes e linhas) e `--spacing-spinner-lg` (32px: telas). */
const SIZES: Record<SpinnerSize, string> = {
  sm: 'size-spinner',
  lg: 'size-spinner-lg',
};

type SpinnerProps = {
  size?: SpinnerSize;
  /** Com `label`, o spinner vira `role="status"` e o texto e lido por leitores de tela. */
  label?: string;
  className?: string;
};

/**
 * Indicador de carregamento em SVG inline que herda a cor do texto (`currentColor`).
 * Sem `label` e decorativo (`aria-hidden`): quem o usa deve ter o texto de andamento ao lado.
 */
export function Spinner({ size = 'sm', label, className = '' }: SpinnerProps) {
  const svg = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      aria-hidden="true"
      className={`animate-spinner shrink-0 ${SIZES[size]} ${className}`.trim()}
    >
      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );

  if (!label) {
    return svg;
  }

  return (
    <span role="status" className="inline-flex">
      {svg}
      <span className="sr-only">{label}</span>
    </span>
  );
}
