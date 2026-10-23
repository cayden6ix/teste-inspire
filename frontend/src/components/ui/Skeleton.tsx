type SkeletonVariant = 'line' | 'control' | 'row' | 'stat' | 'card';

/** Alturas derivadas dos tokens: linha de texto, controle, linha de lista, numero e cartao. */
const VARIANTS: Record<SkeletonVariant, string> = {
  line: 'h-4',
  control: 'h-control',
  row: 'h-row',
  stat: 'h-24',
  card: 'h-32',
};

type SkeletonProps = {
  variant?: SkeletonVariant;
  /** Somente largura (ex.: `w-2/5`, `w-full`). A altura vem da variante. */
  className?: string;
};

/** Bloco cinza com brilho deslizante (shimmer) para estados de carregamento. */
export function Skeleton({ variant = 'line', className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer rounded-control bg-slate-200/80 ${VARIANTS[variant]} ${className}`}
    />
  );
}
