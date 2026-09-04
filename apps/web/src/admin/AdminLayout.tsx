// apps/web/src/admin/AdminLayout.tsx
//
// Casca compartilhada por todas as telas do painel admin: guarda de
// acesso (sessão + app_role) rodada uma única vez aqui, navegação por
// abas, e <Outlet/> pra tela da rota atual. Extraído do que antes era
// tudo dentro de AdminApp.tsx (agora só a tela "Visão geral", movida pra
// admin/pages/VisaoGeral.tsx) — mesma lógica, sem duplicar a checagem de
// app_role em cada tela nova.

import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { decodeClaims } from '../lib/claims';
import type { PapelAdmin } from '../data/admin';

const PAPEIS_VALIDOS: PapelAdmin[] = ['admin', 'operacao', 'suporte'];

type EstadoAcesso = 'verificando' | 'negado' | 'liberado';

const ABAS: { rota: string; label: string }[] = [
  { rota: '', label: 'Visão geral' },
  { rota: 'motoristas', label: 'Motoristas' },
  { rota: 'fretes', label: 'Fretes publicados' },
  { rota: 'whatsapp', label: 'Consultas WhatsApp' },
  { rota: 'admins', label: 'Administradores' },
  { rota: 'auditoria', label: 'Auditoria' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [acesso, setAcesso] = useState<EstadoAcesso>('verificando');
  const [papel, setPapel] = useState<PapelAdmin | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (!session) {
        navigate('/entrar', { replace: true });
        return;
      }
      const claims = decodeClaims(session.access_token);
      const papelAtual = claims.app_role as PapelAdmin | undefined;
      if (!papelAtual || !PAPEIS_VALIDOS.includes(papelAtual)) {
        setAcesso('negado');
        return;
      }
      setPapel(papelAtual);
      setAcesso('liberado');
    });
  }, [navigate]);

  if (acesso === 'verificando') return null;

  if (acesso === 'negado') {
    return (
      <main className="tela tela-admin">
        <h1>Acesso restrito</h1>
        <p className="aviso-erro">Esta conta não tem permissão pra acessar o painel admin.</p>
        <button type="button" className="link-secundario" onClick={() => navigate('/')}>
          Voltar pro app
        </button>
      </main>
    );
  }

  return (
    <main className="tela tela-admin">
      <header className="admin-header">
        <div>
          <p className="garagem-eyebrow">Painel admin</p>
        </div>
        <span className="admin-papel-badge">{papel}</span>
      </header>

      <nav className="admin-nav">
        {ABAS.map((a) => (
          <NavLink
            key={a.rota}
            to={a.rota}
            end={a.rota === ''}
            className={({ isActive }) => (isActive ? 'admin-nav-item admin-nav-item-ativo' : 'admin-nav-item')}
          >
            {a.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </main>
  );
}
