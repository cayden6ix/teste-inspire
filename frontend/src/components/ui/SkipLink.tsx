import type { MouseEvent } from 'react';
import { buttonClass } from './Button';

/** Id do `<main>` dos layouts: alvo do link "Pular para o conteúdo". */
export const MAIN_CONTENT_ID = 'conteudo';

/**
 * Primeiro item focavel da pagina (TRV-25): fica acima da tela ate receber foco pelo teclado; leva o
 * foco direto ao conteudo principal, pulando o cabecalho e a navegacao.
 */
export function SkipLink() {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    // Foca o <main> sem mudar a URL (o hash viraria uma navegacao do roteador).
    event.preventDefault();
    document.getElementById(MAIN_CONTENT_ID)?.focus();
  }

  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      onClick={handleClick}
      className={buttonClass({
        className: 'fixed left-4 top-4 z-70 -translate-y-24 focus:translate-y-0',
      })}
    >
      Pular para o conteúdo
    </a>
  );
}
