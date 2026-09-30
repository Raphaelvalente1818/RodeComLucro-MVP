import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabaseClient';

/**
 * Link mágico do bot (30/09/2026): o WhatsApp manda o motorista pro app
 * com `?t=<token de uso único>`. Antes de renderizar qualquer rota, troca
 * o token por sessão na Edge Function sessao-wa (que devolve um
 * token_hash de magiclink) e limpa o `t` da URL. Enquanto troca, mostra
 * uma tela mínima — se as páginas rodassem antes, o getSession delas
 * mandaria pro /entrar antes da sessão existir.
 *
 * Token inválido/vencido: segue pra rota normal (a página pede login).
 * Sessão já existente: ignora o token (não troca de conta por link).
 */
export default function LoginPorLink({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState(() => !new URLSearchParams(window.location.search).get('t'));

  useEffect(() => {
    if (pronto) return;
    const url = new URL(window.location.href);
    const token = url.searchParams.get('t') ?? '';
    url.searchParams.delete('t');
    const limpa = `${url.pathname}${url.search}${url.hash}`;

    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) {
          const r = await supabase.functions.invoke('sessao-wa', { body: { token } });
          if (!r.error && r.data?.token_hash) {
            await supabase.auth.verifyOtp({ token_hash: r.data.token_hash as string, type: 'magiclink' });
          }
        }
      } catch {
        // cai na rota normal; a página pede login.
      } finally {
        window.history.replaceState(null, '', limpa);
        setPronto(true);
      }
    })();
  }, [pronto]);

  if (!pronto) {
    return (
      <main className="tela tela-entrada">
        <div className="entrada-hero entrada-hero-compacto">
          <img src="/img/logo-rode-com-lucro.jpg" alt="Rode com Lucro" className="entrada-logo" width="720" height="621" />
          <p className="entrada-tagline">Entrando…</p>
        </div>
      </main>
    );
  }
  return <>{children}</>;
}
