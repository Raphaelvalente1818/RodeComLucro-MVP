// apps/web/src/pages/empresa/EmpresaHome.tsx
//
// Tela inicial do portal da empresa. Nesta fase (pré-requisito #2 do
// módulo de empresas) mostra só a situação do cadastro: aguardando
// aprovação / aprovada / rejeitada / suspensa. O formulário de publicar
// frete entra na fase seguinte (portal), e só aparece pra empresa
// aprovada.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { carregarMinhaEmpresa, formatarCnpj, sairEmpresa, type Empresa } from '../../lib/empresa';

const TEXTO_STATUS: Record<Empresa['status'], { titulo: string; texto: string; classe: string }> = {
  pendente: {
    titulo: 'Cadastro em análise',
    texto: 'Nossa equipe está conferindo os dados da sua empresa. Assim que for aprovada, você poderá publicar fretes por aqui.',
    classe: 'aviso',
  },
  aprovada: {
    titulo: 'Empresa aprovada',
    texto: 'Sua empresa está liberada pra publicar fretes. A tela de publicação está sendo preparada e estará disponível em breve.',
    classe: 'sucesso',
  },
  rejeitada: {
    titulo: 'Cadastro não aprovado',
    texto: 'Não foi possível aprovar o cadastro da sua empresa.',
    classe: 'aviso-erro',
  },
  suspensa: {
    titulo: 'Empresa suspensa',
    texto: 'A publicação de fretes está suspensa pra sua empresa.',
    classe: 'aviso-erro',
  },
};

export default function EmpresaHome() {
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState<Empresa | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        navigate('/empresa/entrar', { replace: true });
        return;
      }
      try {
        setEmpresa(await carregarMinhaEmpresa());
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[empresa] falha ao carregar empresa', e);
        setErro('Não foi possível carregar os dados da empresa.');
        setEmpresa(null);
      }
    });
  }, [navigate]);

  async function sair() {
    await sairEmpresa();
    navigate('/empresa/entrar', { replace: true });
  }

  if (empresa === undefined) return null;

  if (empresa === null) {
    return (
      <main className="tela tela-entrada">
        <h1>Conta sem empresa</h1>
        <p className="aviso-erro">{erro ?? 'Esta conta não está vinculada a nenhuma empresa.'}</p>
        <button type="button" className="link-secundario" onClick={sair}>
          Sair
        </button>
      </main>
    );
  }

  const st = TEXTO_STATUS[empresa.status];

  return (
    <main className="tela tela-entrada">
      <p className="garagem-eyebrow">Portal da empresa</p>
      <h1>{empresa.nomeFantasia || empresa.razaoSocial}</h1>
      <p className="admin-card-nota">
        {empresa.razaoSocial} · CNPJ {formatarCnpj(empresa.cnpj)}
      </p>

      <section className="admin-card">
        <span className={`admin-card-titulo ${st.classe}`}>{st.titulo}</span>
        <p>{st.texto}</p>
        {empresa.motivoRejeicao && (empresa.status === 'rejeitada' || empresa.status === 'suspensa') && (
          <p className="admin-card-nota">Motivo: {empresa.motivoRejeicao}</p>
        )}
      </section>

      <button type="button" className="link-secundario" onClick={sair}>
        Sair
      </button>
    </main>
  );
}
