import type { ReactNode } from 'react';

type PageProps = {
  children: ReactNode;
};

/** Raiz de toda pagina: secoes empilhadas com o mesmo espacamento vertical (24px). */
export function Page({ children }: PageProps) {
  return <div className="flex flex-col gap-6">{children}</div>;
}
