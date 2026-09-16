// apps/web/src/pages/empresa/EmpresaDados.tsx
//
// "Meus dados" do portal Sofrete: a empresa vê o próprio cadastro e
// corrige o que pode corrigir sozinha (nome fantasia, telefone, e-mail
// de contato). CNPJ e razão social aparecem travados — são a identidade
// que o admin aprovou. Situação do cadastro (pendente/aprovada/...) só
// leitura, com o motivo quando houver.

import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { atualizarMinhaEmpresa, carregarMinhaEmpresa, formatarCnpj, somenteDigitos, type Empresa } from '../../lib/empresa';

const ROTULO_STATUS: Record<Empresa['status'], string> = {
  pendente: 'Em análise',
  aprovada: 'Aprovada',
  rejeitada: 'Não aprovada',
  suspensa: 'Suspensa',
};

const CLASSE_STATUS: Record<Empresa['status'], string> = {
  pendente: 'admin-tag-duplicada',
  aprovada: 'admin-tag-nova',
  rejeitada: 'admin-tag-erro',
  suspensa: 'admin-tag-erro',
};

function formatarTelefone(v: string) {
  const d = somenteDigitos(v).slice(0, 11);
  if (d.length <= 2) return d;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  if (resto.length <= 8) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
}

export default function EmpresaDados() {
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState<Empresa | null | undefined>(undefined);
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        navigate('/empresa/entrar', { replace: true });
        return;
      }
      const e = await carregarMinhaEmpresa().catch(() => null);
      if (!e) {
        navigate('/empresa', { replace: true });
        return;
      }
      setEmpresa(e);
      setNomeFantasia(e.nomeFantasia ?? '');
      setTelefone(e.telefone ?? '');
      setEmail(e.email);
    });
  }, [navigate]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!empresa || salvando) return;
    if (!email.includes('@')) {
      setErro('Informe um e-mail válido.');
      return;
    }
    setSalvando(true);
    setErro(null);
    setSalvo(false);
    try {
      await atualizarMinhaEmpresa(empresa.id, { nomeFantasia, telefone, email });
      setSalvo(true);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[empresa] falha ao salvar dados', e);
      setErro('Não foi possível salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (!empresa) return null;

  return (
    <main className="tela">
      <p className="garagem-eyebrow">Cadastro</p>
      <h1>Meus dados</h1>
      <p className="admin-card-nota">
        CNPJ e razão social são a identidade aprovada pela nossa equipe — pra alterar, fale com a gente. O resto
        você ajusta aqui.
      </p>

      <form className="empresa-form" onSubmit={onSubmit}>
        <p className="empresa-form-secao">Empresa</p>
        <label>
          CNPJ
          <input type="text" value={formatarCnpj(empresa.cnpj)} disabled />
        </label>
        <label>
          Razão social
          <input type="text" value={empresa.razaoSocial} disabled />
        </label>
        <label>
          Nome fantasia (opcional)
          <input type="text" value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} />
        </label>
        <div>
          <span className="admin-card-nota" style={{ display: 'block', marginBottom: 6 }}>
            Situação do cadastro
          </span>
          <span className={`admin-tag ${CLASSE_STATUS[empresa.status]}`}>{ROTULO_STATUS[empresa.status]}</span>
          {empresa.motivoRejeicao && (empresa.status === 'rejeitada' || empresa.status === 'suspensa') && (
            <p className="admin-card-nota" style={{ marginTop: 6 }}>
              Motivo: {empresa.motivoRejeicao}
            </p>
          )}
        </div>

        <p className="empresa-form-secao">Contato</p>
        <label>
          Telefone
          <input
            type="tel"
            inputMode="tel"
            placeholder="(11) 91234-5678"
            value={formatarTelefone(telefone)}
            onChange={(e) => setTelefone(e.target.value)}
          />
        </label>
        <label>
          E-mail de contato
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <p className="admin-card-nota">
          O e-mail de contato não muda o e-mail de login. Pra trocar a senha ou o login, fale com a gente.
        </p>

        {erro && <p className="aviso-erro">{erro}</p>}
        {salvo && <p className="sucesso">Dados salvos.</p>}

        <button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </main>
  );
}
