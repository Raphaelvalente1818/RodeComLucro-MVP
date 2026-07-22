import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

interface EstadoRota {
  telefoneE164?: string;
  canal?: 'sms' | 'whatsapp';
}

export default function Verificacao() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { telefoneE164, canal } = (state ?? {}) as EstadoRota;

  const [codigo, setCodigo] = useState(['', '', '', '', '', '']);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [reenvioEm, setReenvioEm] = useState(60);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!telefoneE164) {
      navigate('/entrar', { replace: true });
    }
  }, [telefoneE164, navigate]);

  useEffect(() => {
    if (reenvioEm <= 0) return;
    const t = setTimeout(() => setReenvioEm((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [reenvioEm]);

  // Autofill via WebOTP API (Android/Chrome). Sem efeito em navegadores
  // sem suporte — feature-detected e silenciosamente ignorado.
  useEffect(() => {
    if (!('OTPCredential' in window)) return;
    const ac = new AbortController();
    (navigator.credentials as unknown as {
      get: (opts: unknown) => Promise<{ code?: string } | null>;
    })
      .get({ otp: { transport: ['sms'] }, signal: ac.signal })
      .then((otp) => {
        if (otp?.code) confirmar(otp.code);
      })
      .catch(() => {});
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onDigit(i: number, v: string) {
    const digit = v.replace(/\D/g, '').slice(-1);
    const novo = [...codigo];
    novo[i] = digit;
    setCodigo(novo);
    if (digit && i < 5) inputsRef.current[i + 1]?.focus();
  }

  async function confirmar(tokenCompleto?: string) {
    if (!telefoneE164) return;
    const token = tokenCompleto ?? codigo.join('');
    if (token.length !== 6) return;

    setCarregando(true);
    setErro(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: `+${telefoneE164}`,
        token,
        type: 'sms',
      });
      if (error) {
        setErro('Codigo invalido ou expirado. Confira e tente de novo.');
        return;
      }
      navigate('/', { replace: true });
    } finally {
      setCarregando(false);
    }
  }

  async function reenviar() {
    if (!telefoneE164 || reenvioEm > 0) return;
    setReenvioEm(60);
    await supabase.functions.invoke('otp-solicitar', {
      body: { telefone_e164: telefoneE164, canal: canal ?? 'sms' },
    });
  }

  return (
    <main className="tela tela-verificacao">
      <h1>Digite o codigo enviado</h1>
      <p>Enviamos um codigo de 6 digitos por {canal === 'whatsapp' ? 'WhatsApp' : 'SMS'}.</p>

      <div className="campos-codigo">
        {codigo.map((d, i) => (
          <input
            key={i}
            ref={(el) => (inputsRef.current[i] = el)}
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => onDigit(i, e.target.value)}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
          />
        ))}
      </div>

      <button type="button" disabled={carregando} onClick={() => confirmar()}>
        {carregando ? 'Verificando...' : 'Confirmar'}
      </button>

      <button type="button" className="link-secundario" disabled={reenvioEm > 0} onClick={reenviar}>
        {reenvioEm > 0 ? `Reenviar em ${reenvioEm}s` : 'Reenviar codigo'}
      </button>

      {erro && <p className="aviso-erro">{erro}</p>}
    </main>
  );
}
