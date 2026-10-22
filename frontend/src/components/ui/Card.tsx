import type { ReactNode } from 'react';

type CardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function Card({ title, description, actions, children, className = '' }: CardProps) {
  return (
    <section className={`rounded border border-slate-200 bg-white p-5 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
