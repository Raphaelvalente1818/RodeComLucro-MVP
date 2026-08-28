// apps/web/src/pages/Motorista.tsx
//
// Cadastro/edição do motorista: nome, UF base e meta de lucro mensal.
// A linha em public.motoristas já existe desde o primeiro login — esta
// tela só faz update, nunca cria. canal_wa_ativo e telefone_verificado
// são mostrados como status (só leitura): o vínculo real do WhatsApp
// passa pelo fluxo de código em wa_vinculo, não por aqui.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
  carregarMotorista,
  salvarMotorista,
  motoristaParaForm,
  iniciarVinculoWhatsapp,
  type FormMotorista,
  type VinculoWhatsapp,
} from '../lib/motorista';
import { buscarMunicipios, type Municipio } from '../lib/municipios';

function fmtHoraBR(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const FORM_VAZIO: FormMotorista = {
  nome: '',
  uf_base: '',
  cidade_base: '',
  cidade_base_lat: null,
  cidade_base_lng: null,
  metaAlvoReais: null,
  cnhNumero: '',
  cnhVencimento: '',
  exameToxicologicoVencimento: '',
};

export default function Motorista() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [telefoneVerificado, setTelefoneVerificado] = useState(false);
  const [canalWaAtivo, setCanalWaAtivo] = useState(false);

  // Vínculo do WhatsApp: gera um código de uso único (10min) e o link
  // pronto pra abrir o WhatsApp já com a mensagem — ver lib/motorista.ts
  // (iniciarVinculoWhatsapp) e supabase/functions/wa-vincular.
  const [vinculo, setVinculo] = useState<VinculoWhatsapp | null>(null);
  const [gerandoVinculo, setGerandoVinculo] = useState(false);
  const [erroVinculo, setErroVinculo] = useState<string | null>(null);

  const [form, setForm] = useState<FormMotorista>(FORM_VAZIO);

  // Cidade base: mesmo autocomplete de lib/municipios.ts usado em Buscar
  // Frete (cidade "onde estou agora") — aqui é "onde moro/sou baseado".
  const [cidadeTexto, setCidadeTexto] = useState('');
  const [cidadeSelecionada, setCidadeSelecionada] = useState<Municipio | null>(null);
  const [sugestoesCidade, setSugestoesCidade] = useState<Municipio[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) {
        navigate('/entrar', { replace: true });
        return;
      }
      setUserId(uid);
      const m = await carregarMotorista(uid);
      if (m) {
        setForm(motoristaParaForm(m));
        setTelefoneVerificado(m.telefone_verificado);
        setCanalWaAtivo(m.canal_wa_ativo);
        if (m.cidade_base && m.cidade_base_lat != null && m.cidade_base_lng != null) {
          setCidadeTexto(`${m.cidade_base}/${m.uf_base ?? ''}`);
          setCidadeSelecionada({ nome: m.cidade_base, uf: m.uf_base ?? '', latitude: m.cidade_base_lat, longitude: m.cidade_base_lng });
        } else if (m.uf_base) {
          // Cadastro antigo, só com UF (sem cidade) — mostra o que tem, mas
          // sem marcar como "selecionado" (precisa escolher uma cidade da
          // lista pra preencher lat/lng e ficar completo).
          setCidadeTexto(m.uf_base);
        }
      }
      setCarregando(false);
    });
  }, [navigate]);

  useEffect(() => {
    if (cidadeSelecionada && cidadeTexto === `${cidadeSelecionada.nome}/${cidadeSelecionada.uf}`) {
      setSugestoesCidade([]);
      return;
    }
    const handle = setTimeout(() => {
      buscarMunicipios(cidadeTexto).then(setSugestoesCidade);
    }, 300);
    return () => clearTimeout(handle);
  }, [cidadeTexto, cidadeSelecionada]);

  function selecionarCidadeBase(m: Municipio) {
    setCidadeSelecionada(m);
    setCidadeTexto(`${m.nome}/${m.uf}`);
    setSugestoesCidade([]);
    setForm((f) => ({ ...f, cidade_base: m.nome, uf_base: m.uf, cidade_base_lat: m.latitude, cidade_base_lng: m.longitude }));
    setSalvo(false);
  }

  function campo<K extends keyof FormMotorista>(chave: K, valor: FormMotorista[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
    setSalvo(false);
  }

  async function salvar() {
    if (!userId) return;
    setSalvando(true);
    setErro(null);
    const { error } = await salvarMotorista(userId, form);
    setSalvando(false);
    if (error) {
      setErro(error);
      return;
    }
    setSalvo(true);
  }

  async function vincularWhatsapp() {
    setGerandoVinculo(true);
    setErroVinculo(null);
    const { vinculo: novo, erro: err } = await iniciarVinculoWhatsapp();
    setGerandoVinculo(false);
    if (err) {
      setErroVinculo(err);
      return;
    }
    setVinculo(novo);
  }

  if (carregando) return null;

  return (
    <main className="tela">
      <h1>Meu perfil</h1>

      <label>
        Nome
        <input value={form.nome} onChange={(e) => campo('nome', e.target.value)} placeholder="Como podemos te chamar" />
      </label>

      <label>
        Cidade base
        <input
          value={cidadeTexto}
          onChange={(e) => {
            setCidadeTexto(e.target.value);
            setCidadeSelecionada(null);
          }}
          placeholder="Ex.: São Bernardo do Campo/SP"
        />
      </label>
      {sugestoesCidade.length > 0 && (
        <ul className="sugestoes-box">
          {sugestoesCidade.map((m) => (
            <li key={`${m.nome}-${m.uf}`}>
              <button type="button" className="sugestao-item" onClick={() => selecionarCidadeBase(m)}>
                {m.nome}/{m.uf}
              </button>
            </li>
          ))}
        </ul>
      )}

      <label>
        Meta de lucro mensal (R$)
        <input
          type="number"
          step="100"
          min={0}
          value={form.metaAlvoReais ?? ''}
          onChange={(e) => campo('metaAlvoReais', e.target.value === '' ? null : Number(e.target.value))}
          placeholder="Ex.: 5000"
        />
      </label>

      <label>
        Número da CNH
        <input
          inputMode="numeric"
          value={form.cnhNumero}
          onChange={(e) => campo('cnhNumero', e.target.value)}
          placeholder="Ex.: 12345678900"
        />
      </label>

      <label>
        Vencimento da CNH
        <input type="date" value={form.cnhVencimento} onChange={(e) => campo('cnhVencimento', e.target.value)} />
      </label>

      <label>
        Validade do Exame Toxicológico
        <input
          type="date"
          value={form.exameToxicologicoVencimento}
          onChange={(e) => campo('exameToxicologicoVencimento', e.target.value)}
        />
      </label>

      <div className="garagem-status">
        <span className={telefoneVerificado ? 'sucesso' : 'aviso'}>
          Telefone {telefoneVerificado ? 'verificado' : 'não verificado'}
        </span>
        <span className={canalWaAtivo ? 'sucesso' : 'aviso'}>
          WhatsApp {canalWaAtivo ? 'vinculado' : 'não vinculado'}
        </span>
      </div>

      {!canalWaAtivo && (
        <div className="vinculo-whatsapp">
          {!vinculo ? (
            <button type="button" className="link-secundario" disabled={gerandoVinculo} onClick={vincularWhatsapp}>
              {gerandoVinculo ? 'Gerando código...' : 'Vincular WhatsApp'}
            </button>
          ) : (
            <>
              <a href={vinculo.waLink} target="_blank" rel="noreferrer" className="btn-frete-analisar">
                Abrir WhatsApp e enviar código
              </a>
              <p className="aviso">
                Toque no botão acima — o WhatsApp abre com a mensagem pronta, é só enviar. Código válido até
                as {fmtHoraBR(vinculo.expiraEm)}.
              </p>
              <button type="button" className="link-secundario" disabled={gerandoVinculo} onClick={vincularWhatsapp}>
                Gerar outro código
              </button>
            </>
          )}
          {erroVinculo && <p className="aviso-erro">{erroVinculo}</p>}
        </div>
      )}

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
