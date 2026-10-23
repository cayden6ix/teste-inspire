import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/** Quanto esperar o `h1` aparecer em paginas que carregam dados antes de montar o titulo. */
const HEADING_WAIT_MS = 3000;

type PageTransitionProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Transicao entre rotas: o conteudo (nao o cabecalho do layout) entra com fade + leve slide-up
 * (`animate-slide-up`, 200ms, so opacity/transform: sem layout shift). A chave por `pathname`
 * remonta o conteudo a cada rota, inclusive na alternancia Lista/Quadro.
 *
 * Acessibilidade: a cada navegacao o foco vai para o topo do conteudo (sem rolar o foco para
 * longe do usuario), a rolagem volta ao topo e uma regiao `role="status"` anuncia o titulo da
 * nova pagina (o `h1`, quando ele aparece). A primeira renderizacao nao rouba o foco.
 */
export function PageTransition({ children, className = '' }: PageTransitionProps) {
  const { pathname } = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const previous = useRef(pathname);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (previous.current === pathname) {
      return;
    }

    previous.current = pathname;

    const container = containerRef.current;
    if (!container) {
      return;
    }

    window.scrollTo({ top: 0 });
    container.focus({ preventScroll: true });
    setAnnouncement('');

    const announce = () => {
      const heading = container.querySelector('h1')?.innerText.replace(/\s+/g, ' ').trim();
      if (heading) {
        setAnnouncement(`Página: ${heading}`);
        return true;
      }
      return false;
    };

    if (announce()) {
      return;
    }

    // Paginas com dados mostram o titulo so depois de carregar: espera o h1 aparecer.
    const observer = new MutationObserver(() => {
      if (announce()) {
        observer.disconnect();
      }
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    const timer = window.setTimeout(() => observer.disconnect(), HEADING_WAIT_MS);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return (
    <>
      <div
        key={pathname}
        ref={containerRef}
        tabIndex={-1}
        data-route-transition={pathname}
        className={`animate-slide-up outline-none ${className}`.trim()}
      >
        {children}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
