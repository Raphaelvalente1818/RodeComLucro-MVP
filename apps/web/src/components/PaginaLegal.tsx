// apps/web/src/components/PaginaLegal.tsx
//
// Moldura das páginas públicas /termos e /privacidade (09/10/2026): abre sem
// login, fora da barra de abas, tema escuro do app, texto corrido legível no
// celular. O conteúdo é JSX puro (h2/p/ul) — sem markdown, sem dependência.

import type { ReactNode } from 'react';

export default function PaginaLegal({ titulo, versao, children }: { titulo: string; versao: string; children: ReactNode }) {
  return (
    <main className="tela tela-legal">
      <header className="garagem-header">
        <div>
          <p className="garagem-eyebrow">Rode com Lucro</p>
          <h1>{titulo}</h1>
        </div>
      </header>
      <p className="legal-versao">Versão {versao}</p>
      <article className="legal-corpo">{children}</article>
      <p className="legal-rodape">
        <a href="/termos">Termos de uso</a> · <a href="/privacidade">Política de privacidade</a> · <a href="/">Voltar ao app</a>
      </p>
    </main>
  );
}
