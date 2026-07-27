import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [telefoneVerificado, setTelefoneVerificado] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate('/entrar', { replace: true });
        return;
      }
      const appMeta = data.session.user.app_metadata as Record<string, unknown>;
      setTelefoneVerificado(Boolean(appMeta?.telefone_verificado));
      setCarregando(false);
    });
  }, [navigate]);

  if (carregando) return null;

  return (
    <main className="tela">
      <h1>Rode com Lucro</h1>
      <p>Telefone verificado: {telefoneVerificado ? 'sim' : 'nao'}</p>

      <button type="button" onClick={() => navigate('/analisar')}>
        Analisar frete
      </button>
      <button type="button" className="link-secundario" onClick={() => navigate('/perfil')}>
        Perfil do caminhão
      </button>
    </main>
  );
}
