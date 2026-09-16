// apps/web/src/pages/empresa/EmpresaLayout.tsx
//
// Casca do portal Sofrete (lado da empresa): aplica o tema no <body>,
// cabeçalho com logotipo, navegação (só com sessão) e o alternador
// claro/escuro. Ver Docs/mockup-portal-empresa.html e o bloco "SOFRETE"
// no index.css.
//
// Por que a classe vai no <body> e não no <main>: o fundo da página é do
// body (background: var(--bg)), e num tema claro a diferença entre
// "página clara" e "card claro num fundo preto" é exatamente essa.
// Removida no unmount pra não vazar pro app do motorista quando a
// pessoa navega pra fora do /empresa.

import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { carregarMinhaEmpresa, sairEmpresa, type Empresa } from '../../lib/empresa';

type Tema = 'claro' | 'escuro';
const CHAVE_TEMA = 'sofrete-tema';

function lerTema(): Tema {
  try {
    return localStorage.getItem(CHAVE_TEMA) === 'escuro' ? 'escuro' : 'claro';
  } catch {
    return 'claro';
  }
}

export default function EmpresaLayout() {
  const navigate = useNavigate();
  const [tema, setTema] = useState<Tema>(lerTema);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  useEffect(() => {
    document.body.classList.add('tema-empresa');
    return () => {
      document.body.classList.remove('tema-empresa', 'tema-empresa-escuro');
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('tema-empresa-escuro', tema === 'escuro');
    try {
      localStorage.setItem(CHAVE_TEMA, tema);
    } catch {
      // sem storage (modo privado etc.) — o tema só não persiste.
    }
  }, [tema]);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const e = await carregarMinhaEmpresa().catch(() => null);
      if (ativo) setEmpresa(e);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (!session) setEmpresa(null);
      else carregarMinhaEmpresa().then((e) => ativo && setEmpresa(e)).catch(() => undefined);
    });
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function sair() {
    await sairEmpresa();
    navigate('/empresa/entrar', { replace: true });
  }

  return (
    <>
      <header className="empresa-topo">
        <div className="empresa-topo-inner">
          <NavLink to="/empresa" className="sofrete-logo">
            <span className="sofrete-logo-marca" aria-hidden="true" />
            Sofrete
            <small>Empresas</small>
          </NavLink>

          {empresa && (
            <nav className="empresa-nav">
              <NavLink to="/empresa" end className={({ isActive }) => (isActive ? 'ativo' : undefined)}>
                Início
              </NavLink>
              {empresa.status === 'aprovada' && (
                <NavLink to="/empresa/publicar" className={({ isActive }) => (isActive ? 'ativo' : undefined)}>
                  Publicar frete
                </NavLink>
              )}
              <NavLink to="/empresa/dados" className={({ isActive }) => (isActive ? 'ativo' : undefined)}>
                Meus dados
              </NavLink>
            </nav>
          )}

          <div className="empresa-topo-direita">
            {empresa && (
              <span>
                <i className="ponto" aria-hidden="true" />
                {empresa.nomeFantasia || empresa.razaoSocial}
              </span>
            )}
            <button
              type="button"
              className="tema-toggle"
              onClick={() => setTema((t) => (t === 'claro' ? 'escuro' : 'claro'))}
              aria-label={tema === 'claro' ? 'Mudar para tema escuro' : 'Mudar para tema claro'}
            >
              {tema === 'claro' ? '☾ Escuro' : '☼ Claro'}
            </button>
            {empresa && (
              <button type="button" className="tema-toggle" onClick={sair}>
                Sair
              </button>
            )}
          </div>
        </div>
      </header>
      <Outlet />
    </>
  );
}
