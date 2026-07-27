// apps/web/src/pages/Perfil.tsx
//
// Tela 3 do calc-app (Fase 1): dados do caminhão (consumo, custos/km,
// margem desejada) usados como default na tela Analisar. Upsert único por
// user_id (um perfil por motorista, por enquanto).

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { carregarPerfil, salvarPerfil, PERFIL_DEFAULT, type CaminhaoPerfil } from '../lib/frete';

type FormPerfil = Omit<CaminhaoPerfil, 'id' | 'user_id'>;

export default function Perfil() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [perfilId, setPerfilId] = useState<string | undefined>(undefined);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [form, setForm] = useState<FormPerfil>(PERFIL_DEFAULT);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) {
        navigate('/entrar', { replace: true });
        return;
      }
      setUserId(uid);
      const p = await carregarPerfil(uid);
      if (p) {
        setPerfilId(p.id);
        const { id: _id, user_id: _uid, ...resto } = p;
        setForm(resto);
      }
      setCarregando(false);
    });
  }, [navigate]);

  function campo<K extends keyof FormPerfil>(chave: K, valor: FormPerfil[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
    setSalvo(false);
  }

  async function salvar() {
    if (!userId) return;
    setSalvando(true);
    setErro(null);
    const { error } = await salvarPerfil(userId, form, perfilId);
    setSalvando(false);
    if (error) {
      setErro(error);
      return;
    }
    setSalvo(true);
  }

  if (carregando) return null;

  return (
    <main className="tela tela-perfil">
      <h1>Perfil do caminhão</h1>

      <label>
        Apelido
        <input value={form.apelido ?? ''} onChange={(e) => campo('apelido', e.target.value)} placeholder="Ex.: Scania vermelha" />
      </label>

      <label>
        Número de eixos
        <input
          type="number"
          min={2}
          max={9}
          value={form.numero_eixos}
          onChange={(e) => campo('numero_eixos', Number(e.target.value))}
        />
      </label>

      <label>
        UF base
        <input
          value={form.uf_base ?? ''}
          maxLength={2}
          onChange={(e) => campo('uf_base', e.target.value.toUpperCase())}
          placeholder="Ex.: SP"
        />
      </label>

      <label>
        Consumo diesel (km/L)
        <input type="number" step="0.1" value={form.diesel_km_por_lt} onChange={(e) => campo('diesel_km_por_lt', Number(e.target.value))} />
      </label>

      <label>
        Preço diesel (R$/L)
        <input type="number" step="0.01" value={form.diesel_preco_por_litro} onChange={(e) => campo('diesel_preco_por_litro', Number(e.target.value))} />
      </label>

      <label>
        Consumo ARLA 32 (km/L)
        <input type="number" step="0.1" value={form.arla_km_por_lt} onChange={(e) => campo('arla_km_por_lt', Number(e.target.value))} />
      </label>

      <label>
        Preço ARLA 32 (R$/L)
        <input type="number" step="0.01" value={form.arla_preco_por_litro} onChange={(e) => campo('arla_preco_por_litro', Number(e.target.value))} />
      </label>

      <label>
        Manutenção (R$/km)
        <input type="number" step="0.01" value={form.manutencao_por_km} onChange={(e) => campo('manutencao_por_km', Number(e.target.value))} />
      </label>

      <label>
        Pneus (R$/km)
        <input type="number" step="0.01" value={form.pneus_por_km} onChange={(e) => campo('pneus_por_km', Number(e.target.value))} />
      </label>

      <label>
        Depreciação (R$/km)
        <input type="number" step="0.01" value={form.depreciacao_por_km} onChange={(e) => campo('depreciacao_por_km', Number(e.target.value))} />
      </label>

      <label>
        Alimentação por dia (R$)
        <input type="number" step="1" value={form.alimentacao_dia} onChange={(e) => campo('alimentacao_dia', Number(e.target.value))} />
      </label>

      <label>
        Pernoite por dia (R$)
        <input type="number" step="1" value={form.pernoite_dia} onChange={(e) => campo('pernoite_dia', Number(e.target.value))} />
      </label>

      <label>
        Estacionamento padrão (R$)
        <input type="number" step="1" value={form.estacionamento_padrao} onChange={(e) => campo('estacionamento_padrao', Number(e.target.value))} />
      </label>

      <label>
        Chapa padrão (R$)
        <input type="number" step="1" value={form.chapa_padrao} onChange={(e) => campo('chapa_padrao', Number(e.target.value))} />
      </label>

      <label>
        Margem desejada: {form.margem_desejada}%
        <input
          type="range"
          min={5}
          max={40}
          step={1}
          value={form.margem_desejada}
          onChange={(e) => campo('margem_desejada', Number(e.target.value))}
        />
      </label>

      <button type="button" disabled={salvando} onClick={salvar}>
        {salvando ? 'Salvando...' : 'Salvar perfil'}
      </button>
      {salvo && <p className="sucesso">Perfil salvo.</p>}
      {erro && <p className="aviso-erro">Não foi possível salvar: {erro}</p>}

      <button type="button" className="link-secundario" onClick={() => navigate('/')}>
        Voltar
      </button>
    </main>
  );
}
