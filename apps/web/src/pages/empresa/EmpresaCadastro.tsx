// apps/web/src/pages/empresa/EmpresaCadastro.tsx
//
// Auto-cadastro da empresa (embarcador): e-mail + senha + CNPJ + dados.
// Depois do cadastro a empresa fica 'pendente' até o admin aprovar —
// só então pode publicar frete. Ver lib/empresa.ts.

import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cadastrarEmpresa, cnpjDisponivel, cnpjValido, formatarCnpj, somenteDigitos } from '../../lib/empresa';

function formatarTelefone(v: string) {
  const d = somenteDigitos(v).slice(0, 11);
  if (d.length <= 2) return d;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  if (resto.length <= 8) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
}

export default function EmpresaCadastro() {
  const navigate = useNavigate();
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [aceite, setAceite] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarEmail, setConfirmarEmail] = useState(false);

  const cnpjOk = cnpjValido(cnpj);
  const podeEnviar =
    cnpjOk && razaoSocial.trim().length >= 3 && email.includes('@') && senha.length >= 8 && aceite && !carregando;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;
    setCarregando(true);
    setErro(null);
    try {
      if (!(await cnpjDisponivel(cnpj))) {
        setErro('Já existe uma empresa cadastrada com esse CNPJ. Se é a sua, entre com o e-mail usado no cadastro.');
        return;
      }
      const { precisaConfirmarEmail } = await cadastrarEmpresa({ email, senha, cnpj, razaoSocial, nomeFantasia, telefone });
      if (precisaConfirmarEmail) {
        setConfirmarEmail(true);
        return;
      }
      navigate('/empresa', { replace: true });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[empresa] falha no cadastro', e);
      const msg = e instanceof Error ? e.message : '';
      if (/already registered|already exists/i.test(msg)) {
        setErro('Já existe uma conta com esse e-mail. Tente entrar.');
      } else if (/password/i.test(msg)) {
        setErro('Senha fraca. Use pelo menos 8 caracteres.');
      } else {
        setErro('Não foi possível concluir o cadastro. Tente novamente.');
      }
    } finally {
      setCarregando(false);
    }
  }

  if (confirmarEmail) {
    return (
      <main className="tela tela-entrada">
        <h1>Confirme seu e-mail</h1>
        <p>
          Enviamos um link de confirmação para <strong>{email}</strong>. Abra o e-mail, clique no link e depois entre no
          portal.
        </p>
        <Link to="/empresa/entrar" className="link-secundario">
          Ir para o login
        </Link>
      </main>
    );
  }

  return (
    <main className="tela tela-entrada">
      <p className="garagem-eyebrow">Portal da empresa</p>
      <h1>Cadastrar empresa</h1>
      <p className="admin-card-nota">
        Publique fretes direto pros motoristas do Rode com Lucro. O cadastro passa por uma aprovação rápida da nossa
        equipe antes de liberar a publicação.
      </p>

      <form onSubmit={onSubmit}>
        <label htmlFor="cnpj">CNPJ</label>
        <input
          id="cnpj"
          type="text"
          inputMode="numeric"
          placeholder="00.000.000/0000-00"
          value={formatarCnpj(cnpj)}
          onChange={(e) => setCnpj(e.target.value)}
        />
        {somenteDigitos(cnpj).length === 14 && !cnpjOk && <p className="aviso-erro">CNPJ inválido.</p>}

        <label htmlFor="razao">Razão social</label>
        <input id="razao" type="text" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} />

        <label htmlFor="fantasia">Nome fantasia (opcional)</label>
        <input id="fantasia" type="text" value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} />

        <label htmlFor="tel">Telefone de contato (opcional)</label>
        <input
          id="tel"
          type="tel"
          inputMode="tel"
          placeholder="(11) 91234-5678"
          value={formatarTelefone(telefone)}
          onChange={(e) => setTelefone(e.target.value)}
        />

        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label htmlFor="senha">Senha (mínimo 8 caracteres)</label>
        <input
          id="senha"
          type="password"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <label className="checkbox">
          <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
          Li e aceito os{' '}
          <a href="/termos" target="_blank" rel="noreferrer">
            Termos de uso
          </a>{' '}
          e a{' '}
          <a href="/privacidade" target="_blank" rel="noreferrer">
            Política de privacidade
          </a>
        </label>

        <button type="submit" disabled={!podeEnviar}>
          {carregando ? 'Cadastrando…' : 'Cadastrar'}
        </button>

        {erro && <p className="aviso-erro">{erro}</p>}

        <Link to="/empresa/entrar" className="link-secundario">
          Já tenho cadastro
        </Link>
      </form>
    </main>
  );
}
