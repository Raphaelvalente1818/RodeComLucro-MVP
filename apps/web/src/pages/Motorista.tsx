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

function fmtHoraBR(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const FORM_VAZIO: FormMotorista = {
  nome: '',
  uf_base: '',
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
      }
      setCarregando(false);
    });
  }, [navigate]);

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
        UF base
        <input
          value={form.uf_base}
          maxLength={2}
          onChange={(e) => campo('uf_base', e.target.value.toUpperCase())}
          placeholder="Ex.: SP"
        />
      </label>

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
