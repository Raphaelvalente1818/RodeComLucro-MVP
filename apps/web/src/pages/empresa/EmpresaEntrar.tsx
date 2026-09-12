// apps/web/src/pages/empresa/EmpresaEntrar.tsx
//
// Login da empresa por e-mail + senha (separado do OTP por telefone do
// motorista). Ver lib/empresa.ts.

import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { entrarEmpresa } from '../../lib/empresa';

export default function EmpresaEntrar() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeEnviar = email.includes('@') && senha.length > 0 && !carregando;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;
    setCarregando(true);
    setErro(null);
    try {
      await entrarEmpresa(email, senha);
      navigate('/empresa', { replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (/not confirmed/i.test(msg)) {
        setErro('E-mail ainda não confirmado. Procure o link de confirmação na sua caixa de entrada.');
      } else {
        setErro('E-mail ou senha incorretos.');
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="tela tela-entrada">
      <p className="garagem-eyebrow">Portal da empresa</p>
      <h1>Entrar</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label htmlFor="senha">Senha</label>
        <input
          id="senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <button type="submit" disabled={!podeEnviar}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>

        {erro && <p className="aviso-erro">{erro}</p>}

        <Link to="/empresa/cadastro" className="link-secundario">
          Ainda não tenho cadastro
        </Link>
      </form>
    </main>
  );
}
