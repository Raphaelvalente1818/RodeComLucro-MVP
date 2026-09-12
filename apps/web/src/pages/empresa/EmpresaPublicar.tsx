// apps/web/src/pages/empresa/EmpresaPublicar.tsx
//
// Formulário de publicação de frete pela empresa (embarcador). Só
// empresa aprovada chega aqui (EmpresaHome decide). Validação é a mesma
// do import do admin (lib/validarFrete.ts); o frete entra como
// pendente_aprovacao e só aparece pros motoristas depois que o admin
// aprova na aba Fretes publicados — pré-requisito #1 do módulo.

import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { VEICULOS, CARROCERIAS } from '@rode/calc';
import { supabase } from '../../lib/supabaseClient';
import { buscarMunicipios, type Municipio } from '../../lib/municipios';
import { validarFrete } from '../../lib/validarFrete';
import { carregarMinhaEmpresa, publicarFrete, somenteDigitos, type Empresa } from '../../lib/empresa';

function CampoCidade({
  id,
  label,
  valor,
  onChange,
  selecionada,
  onSelecionar,
}: {
  id: string;
  label: string;
  valor: string;
  onChange: (v: string) => void;
  selecionada: Municipio | null;
  onSelecionar: (m: Municipio) => void;
}) {
  const [sugestoes, setSugestoes] = useState<Municipio[]>([]);

  useEffect(() => {
    if (selecionada && valor === `${selecionada.nome}/${selecionada.uf}`) {
      setSugestoes([]);
      return;
    }
    const h = setTimeout(() => {
      buscarMunicipios(valor).then(setSugestoes);
    }, 300);
    return () => clearTimeout(h);
  }, [valor, selecionada]);

  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        placeholder="Cidade/UF"
        autoComplete="off"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
      {sugestoes.length > 0 && (
        <ul className="sugestoes-box">
          {sugestoes.map((m) => (
            <li key={`${m.nome}/${m.uf}`}>
              <button
                type="button"
                className="sugestao-item"
                onClick={() => {
                  onSelecionar(m);
                  setSugestoes([]);
                }}
              >
                {m.nome}/{m.uf}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function EmpresaPublicar() {
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState<Empresa | null | undefined>(undefined);

  const [origemTexto, setOrigemTexto] = useState('');
  const [origem, setOrigem] = useState<Municipio | null>(null);
  const [destinoTexto, setDestinoTexto] = useState('');
  const [destino, setDestino] = useState<Municipio | null>(null);
  const [aCombinar, setACombinar] = useState(false);
  const [valorReais, setValorReais] = useState('');
  const [tipoValor, setTipoValor] = useState<'fixo' | 'por_tonelada'>('fixo');
  const [pesoKg, setPesoKg] = useState('');
  const [distanciaKm, setDistanciaKm] = useState('');
  const [dataColeta, setDataColeta] = useState('');
  const [pedagio, setPedagio] = useState<'' | 'empresa' | 'motorista'>('');
  const [veiculos, setVeiculos] = useState<string[]>([]);
  const [carrocerias, setCarrocerias] = useState<string[]>([]);
  const [contatoNome, setContatoNome] = useState('');
  const [contatoTelefone, setContatoTelefone] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        navigate('/empresa/entrar', { replace: true });
        return;
      }
      const e = await carregarMinhaEmpresa().catch(() => null);
      if (!e || e.status !== 'aprovada') {
        navigate('/empresa', { replace: true });
        return;
      }
      setEmpresa(e);
      setContatoTelefone(e.telefone ?? '');
    });
  }, [navigate]);

  function alternar(lista: string[], set: (v: string[]) => void, item: string) {
    set(lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!empresa || enviando) return;

    const errosLocais: string[] = [];
    if (!origem) errosLocais.push('Escolha a cidade de origem na lista.');
    if (!destino) errosLocais.push('Escolha a cidade de destino na lista.');
    if (!aCombinar && !valorReais.trim()) errosLocais.push('Informe o valor do frete ou marque "Valor a combinar".');
    if (errosLocais.length) {
      setErros(errosLocais);
      return;
    }

    const r = validarFrete({
      empresa_nome: empresa.nomeFantasia || empresa.razaoSocial,
      contato_nome: contatoNome,
      contato_telefone: somenteDigitos(contatoTelefone),
      origem_cidade: origem!.nome,
      origem_uf: origem!.uf,
      destino_cidade: destino!.nome,
      destino_uf: destino!.uf,
      valor_frete_reais: aCombinar ? null : valorReais,
      tipo_valor: aCombinar ? null : tipoValor,
      peso_kg: pesoKg,
      distancia_km: distanciaKm,
      data_coleta: dataColeta,
      pedagio_por_conta_de: pedagio || null,
      tipos_veiculo_aceitos: veiculos,
      tipos_carroceria_aceitos: carrocerias,
      observacoes,
    });

    if (!r.valido || !r.dado) {
      setErros(r.erros);
      return;
    }

    setEnviando(true);
    setErros([]);
    try {
      await publicarFrete(empresa, r.dado);
      navigate('/empresa', { replace: true, state: { publicado: true } });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[empresa] falha ao publicar frete', e);
      setErros(['Não foi possível publicar o frete. Tente novamente.']);
    } finally {
      setEnviando(false);
    }
  }

  if (empresa === undefined) return null;
  if (!empresa) return null;

  return (
    <main className="tela tela-entrada">
      <p className="garagem-eyebrow">Portal da empresa</p>
      <h1>Publicar frete</h1>
      <p className="admin-card-nota">
        O frete passa por uma conferência rápida da nossa equipe antes de aparecer pros motoristas.
      </p>

      <form onSubmit={onSubmit}>
        <CampoCidade
          id="origem"
          label="Origem"
          valor={origemTexto}
          onChange={(v) => {
            setOrigemTexto(v);
            setOrigem(null);
          }}
          selecionada={origem}
          onSelecionar={(m) => {
            setOrigem(m);
            setOrigemTexto(`${m.nome}/${m.uf}`);
          }}
        />

        <CampoCidade
          id="destino"
          label="Destino"
          valor={destinoTexto}
          onChange={(v) => {
            setDestinoTexto(v);
            setDestino(null);
          }}
          selecionada={destino}
          onSelecionar={(m) => {
            setDestino(m);
            setDestinoTexto(`${m.nome}/${m.uf}`);
          }}
        />

        <label className="checkbox">
          <input type="checkbox" checked={aCombinar} onChange={(e) => setACombinar(e.target.checked)} />
          Valor a combinar
        </label>

        {!aCombinar && (
          <>
            <label htmlFor="valor">Valor do frete (R$)</label>
            <input
              id="valor"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={valorReais}
              onChange={(e) => setValorReais(e.target.value)}
            />
            <label htmlFor="tipoValor">Tipo de valor</label>
            <select id="tipoValor" value={tipoValor} onChange={(e) => setTipoValor(e.target.value as 'fixo' | 'por_tonelada')}>
              <option value="fixo">Valor fixo (viagem)</option>
              <option value="por_tonelada">Por tonelada</option>
            </select>
          </>
        )}

        <label htmlFor="peso">Peso (kg, opcional)</label>
        <input id="peso" type="number" inputMode="numeric" min="0" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} />

        <label htmlFor="dist">Distância (km, opcional)</label>
        <input
          id="dist"
          type="number"
          inputMode="numeric"
          min="0"
          value={distanciaKm}
          onChange={(e) => setDistanciaKm(e.target.value)}
        />

        <label htmlFor="coleta">Data de coleta (opcional)</label>
        <input id="coleta" type="date" value={dataColeta} onChange={(e) => setDataColeta(e.target.value)} />

        <label htmlFor="pedagio">Pedágio por conta de</label>
        <select id="pedagio" value={pedagio} onChange={(e) => setPedagio(e.target.value as '' | 'empresa' | 'motorista')}>
          <option value="">Não informado</option>
          <option value="empresa">Empresa</option>
          <option value="motorista">Motorista</option>
        </select>

        <div className="chip-secao">
          <p className="chip-secao-titulo">Tipos de veículo aceitos (vazio = qualquer)</p>
          {VEICULOS.map(({ categoria, opcoes }) => (
            <div key={categoria} className="chip-grupo">
              <p className="chip-grupo-label">{categoria}</p>
              <div className="chip-grid">
                {opcoes.map((op) => (
                  <button
                    key={op}
                    type="button"
                    className={`chip ${veiculos.includes(op) ? 'chip-ativo' : ''}`}
                    onClick={() => alternar(veiculos, setVeiculos, op)}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="chip-secao">
          <p className="chip-secao-titulo">Tipos de carroceria aceitos (vazio = qualquer)</p>
          {CARROCERIAS.map(({ categoria, opcoes }) => (
            <div key={categoria} className="chip-grupo">
              <p className="chip-grupo-label">{categoria}</p>
              <div className="chip-grid">
                {opcoes.map((op) => (
                  <button
                    key={op}
                    type="button"
                    className={`chip ${carrocerias.includes(op) ? 'chip-ativo' : ''}`}
                    onClick={() => alternar(carrocerias, setCarrocerias, op)}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <label htmlFor="contatoNome">Nome do contato (opcional)</label>
        <input id="contatoNome" type="text" value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} />

        <label htmlFor="contatoTel">Telefone do contato (o motorista vê este número)</label>
        <input
          id="contatoTel"
          type="tel"
          inputMode="tel"
          value={contatoTelefone}
          onChange={(e) => setContatoTelefone(e.target.value)}
        />

        <label htmlFor="obs">Observações (opcional)</label>
        <textarea id="obs" rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />

        {erros.length > 0 && (
          <ul className="admin-lista-simples">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <button type="submit" disabled={enviando}>
          {enviando ? 'Publicando…' : 'Enviar pra aprovação'}
        </button>

        <button type="button" className="link-secundario" onClick={() => navigate('/empresa')}>
          Cancelar
        </button>
      </form>
    </main>
  );
}
