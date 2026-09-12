// apps/web/src/pages/empresa/EmpresaHome.tsx
//
// Tela inicial do portal da empresa: situação do cadastro (pendente /
// aprovada / rejeitada / suspensa), botão de publicar frete (só
// aprovada) e lista dos fretes da própria empresa com o status de cada
// um (pendente_aprovacao → aberto quando o admin aprova; rejeitado com
// motivo).

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fmtBRL } from '@rode/calc';
import { supabase } from '../../lib/supabaseClient';
import {
  carregarFretesDaEmpresa,
  carregarMinhaEmpresa,
  formatarCnpj,
  sairEmpresa,
  type Empresa,
  type FreteDaEmpresa,
} from '../../lib/empresa';

const TEXTO_STATUS: Record<Empresa['status'], { titulo: string; texto: string; classe: string }> = {
  pendente: {
    titulo: 'Cadastro em análise',
    texto: 'Nossa equipe está conferindo os dados da sua empresa. Assim que for aprovada, você poderá publicar fretes por aqui.',
    classe: 'aviso',
  },
  aprovada: {
    titulo: 'Empresa aprovada',
    texto: 'Sua empresa está liberada pra publicar fretes.',
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

const STATUS_FRETE: Record<string, { label: string; classe: string }> = {
  pendente_aprovacao: { label: 'em análise', classe: 'admin-tag-duplicada' },
  aberto: { label: 'publicado', classe: 'admin-tag-nova' },
  negociando: { label: 'negociando', classe: 'admin-tag-nova' },
  fechado: { label: 'fechado', classe: '' },
  expirado: { label: 'expirado', classe: '' },
  rejeitado: { label: 'não aprovado', classe: 'admin-tag-erro' },
};

function fmtDataBR(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('pt-BR');
}

export default function EmpresaHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const publicadoAgora = Boolean((location.state as { publicado?: boolean } | null)?.publicado);
  const [empresa, setEmpresa] = useState<Empresa | null | undefined>(undefined);
  const [fretes, setFretes] = useState<FreteDaEmpresa[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        navigate('/empresa/entrar', { replace: true });
        return;
      }
      try {
        const e = await carregarMinhaEmpresa();
        setEmpresa(e);
        if (e) setFretes(await carregarFretesDaEmpresa(e.id));
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

      {publicadoAgora && <p className="sucesso">Frete enviado pra aprovação. Você acompanha o status na lista abaixo.</p>}

      <section className="admin-card">
        <span className={`admin-card-titulo ${st.classe}`}>{st.titulo}</span>
        <p>{st.texto}</p>
        {empresa.motivoRejeicao && (empresa.status === 'rejeitada' || empresa.status === 'suspensa') && (
          <p className="admin-card-nota">Motivo: {empresa.motivoRejeicao}</p>
        )}
        {empresa.status === 'aprovada' && (
          <button type="button" onClick={() => navigate('/empresa/publicar')}>
            Publicar frete
          </button>
        )}
      </section>

      {fretes.length > 0 && (
        <section className="admin-card">
          <span className="admin-card-titulo">Seus fretes</span>
          <div className="admin-tabela-wrap">
            <table className="admin-tabela">
              <thead>
                <tr>
                  <th>Rota</th>
                  <th>Valor</th>
                  <th>Coleta</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {fretes.map((f) => {
                  const s = STATUS_FRETE[f.status] ?? { label: f.status, classe: '' };
                  return (
                    <tr key={f.id}>
                      <td>
                        {f.origemCidade}/{f.origemUf} → {f.destinoCidade}/{f.destinoUf}
                      </td>
                      <td>
                        {f.valorACombinar || f.valorFreteCentavos == null
                          ? 'a combinar'
                          : `${fmtBRL(f.valorFreteCentavos / 100)}${f.tipoValor === 'por_tonelada' ? '/t' : ''}`}
                      </td>
                      <td>{fmtDataBR(f.dataColeta)}</td>
                      <td>
                        <span className={`admin-tag ${s.classe}`}>{s.label}</span>
                        {f.status === 'rejeitado' && f.motivoRejeicao && (
                          <div className="admin-atualizado-em">{f.motivoRejeicao}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <button type="button" className="link-secundario" onClick={sair}>
        Sair
      </button>
    </main>
  );
}
