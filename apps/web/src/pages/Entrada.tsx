import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

function formatarTelefone(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 11);
  const ddd = digits.slice(0, 2);
  const resto = digits.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  if (resto.length <= 8) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
}

export default function Entrada() {
  const navigate = useNavigate();
  const [telefone, setTelefone] = useState('');
  const [aceite, setAceite] = useState(false);
  const [canal, setCanal] = useState<'sms' | 'whatsapp'>('sms');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [bloqueadoAte, setBloqueadoAte] = useState<string | null>(null);

  const digits = telefone.replace(/\D/g, '');
  const telefoneE164 = `55${digits}`;
  const podeEnviar = digits.length >= 10 && aceite && !carregando;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;
    setCarregando(true);
    setErro(null);
    setBloqueadoAte(null);

    try {
      const { data, error } = await supabase.functions.invoke('otp-solicitar', {
        body: { telefone_e164: telefoneE164, canal },
      });

      if (error) {
        // supabase-js expoe o status HTTP do erro em error.context quando disponivel
        const status = (error as { context?: { status?: number } }).context?.status;
        if (status === 429 && data?.bloqueado_ate) {
          setBloqueadoAte(data.bloqueado_ate);
        } else if (status === 503) {
          setErro('Login por telefone temporariamente indisponivel. Tente novamente em instantes.');
        } else {
          setErro('Nao foi possivel enviar o codigo. Tente novamente.');
        }
        return;
      }

      navigate('/verificar', { state: { telefoneE164, canal: data?.canal_efetivo ?? canal } });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="tela tela-entrada">
      <h1>Entrar com telefone</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="telefone">Numero de celular</label>
        <div className="campo-telefone">
          <span>+55</span>
          <input
            id="telefone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 91234-5678"
            value={formatarTelefone(telefone)}
            onChange={(e) => setTelefone(e.target.value)}
          />
        </div>

        <label className="checkbox">
          <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
          Li e aceito os{' '}
          <a href="/termos" target="_blank" rel="noreferrer">Termos de uso</a> e a{' '}
          <a href="/privacidade" target="_blank" rel="noreferrer">Politica de privacidade</a>
        </label>

        <button type="submit" disabled={!podeEnviar}>
          {carregando ? 'Enviando...' : 'Receber codigo'}
        </button>

        <button
          type="button"
          className="link-secundario"
          disabled={!aceite || carregando}
          onClick={() => setCanal('whatsapp')}
        >
          Prefiro receber pelo WhatsApp
        </button>

        {bloqueadoAte && (
          <p className="aviso-erro">
            Muitas tentativas. Tente novamente apos{' '}
            {new Date(bloqueadoAte).toLocaleTimeString('pt-BR')}.
          </p>
        )}
        {erro && <p className="aviso-erro">{erro}</p>}
      </form>
    </main>
  );
}
