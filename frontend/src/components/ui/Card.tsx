import type { AnimationEventHandler, ReactNode } from 'react';

type CardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  onAnimationEnd?: AnimationEventHandler<HTMLElement>;
};

/** Cartao/secao: padding p-card (24px), raio de superficie, titulo de secao. */
export function Card({ title, description, actions, children, className = '', onAnimationEnd }: CardProps) {
  return (
    <section
      onAnimationEnd={onAnimationEnd}
      className={`flex flex-col gap-4 rounded-surface border border-slate-200 bg-white p-card ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-heading font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-1 text-body text-slate-600">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
