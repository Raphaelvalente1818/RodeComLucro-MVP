// apps/web/src/pages/BuscarFrete.tsx
//
// "Busca frete" dentro do app do motorista — lê fretes_publicados
// (ver lib/fretesPublicados.ts e Docs/status-sessao.md, 11/08). Hoje a
// tabela só tem dado de teste importado da Fretebras; a tela não sabe
// disso (não filtra por dado_teste) — quando o portal de empresas nascer
// e passar a publicar fretes reais na mesma tabela, essa tela já mostra
// os dois juntos sem precisar mudar nada.
//
// Pedido do Raphael (11/08): a busca precisa considerar a cidade onde o
// motorista está agora, o raio que ele topa rodar até a origem do frete,
// e a compatibilidade do tipo de veículo dele com o que o frete aceita.
// Distância é em linha reta (haversine, lib/municipios.ts) — decisão
// tomada com o Raphael pra não depender de API paga (Google Routes) numa
// lista inteira de fretes de uma vez.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { fmtBRL } from '@rode/calc';
import type { TipoVeiculo } from '@rode/calc';
import { listarFretesAbertos, UFS_BRASIL, type FretePublicado, type FiltrosFrete } from '../lib/fretesPublicados';
import { carregarMotorista, salvarCidadeAtual } from '../lib/motorista';
import { carregarPerfil } from '../lib/frete';
import { buscarMunicipios, distanciaKm, RAIOS_KM, type Municipio } from '../lib/municipios';

function primeiroNome(nome: string | null | undefined): string | null {
  const t = nome?.trim();
  return t ? t.split(' ')[0] : null;
}

/** Mesma estrutura de mensagem já aprovada pelo Raphael pro contato do frete salvo (Resultado.tsx) — adaptada pro frete publicado. */
function montarMensagemWhatsapp(frete: FretePublicado, nomeMotorista: string | null): string {
  const nomeContato = primeiroNome(frete.contatoNome);
  const saudacao = nomeContato ? `Olá, ${nomeContato}!` : 'Olá!';
  const apresentacao = nomeMotorista ? ` Aqui é o ${nomeMotorista}, motorista.` : '';
  const valor =
    frete.valorACombinar || frete.valorFreteCentavos == null
      ? 'valor a combinar'
      : `valor de ${fmtBRL(frete.valorFreteCentavos / 100)}`;
  const corpo =
    ` Vi o frete de ${frete.origemCidade}/${frete.origemUf} para ${frete.destinoCidade}/${frete.destinoUf}, ${valor}, e tenho interesse. Pode me passar mais detalhes? Preciso saber a data de coleta, o prazo de pagamento e quem fica responsável pelo pedágio. Fico no aguardo, obrigado!`;
  return `${saudacao}${apresentacao}${corpo}`;
}

interface FreteComDistancia extends FretePublicado {
  distancia: number | null;
}

export default function BuscarFrete() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [nomeMotorista, setNomeMotorista] = useState<string | null>(null);
  const [tipoVeiculoPerfil, setTipoVeiculoPerfil] = useState<string | null>(null);

  const [cidadeTexto, setCidadeTexto] = useState('');
  const [cidadeSelecionada, setCidadeSelecionada] = useState<Municipio | null>(null);
  const [sugestoesCidade, setSugestoesCidade] = useState<Municipio[]>([]);
  const [raioKm, setRaioKm] = useState(300);

  const [destinoUf, setDestinoUf] = useState('');
  const [soMeuTipo, setSoMeuTipo] = useState(false);

  const [carregando, setCarregando] = useState(true);
  const [fretes, setFretes] = useState<FretePublicado[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) {
        navigate('/entrar', { replace: true });
        return;
      }
      setUserId(uid);
      const [motorista, perfil] = await Promise.all([carregarMotorista(uid), carregarPerfil(uid)]);
      setNomeMotorista(primeiroNome(motorista?.nome));
      setTipoVeiculoPerfil(perfil?.tipo_veiculo ?? null);
      if (motorista?.cidade_atual && motorista.cidade_atual_lat != null && motorista.cidade_atual_lng != null) {
        setCidadeTexto(`${motorista.cidade_atual}/${motorista.uf_atual ?? ''}`);
        setCidadeSelecionada({
          nome: motorista.cidade_atual,
          uf: motorista.uf_atual ?? '',
          latitude: motorista.cidade_atual_lat,
          longitude: motorista.cidade_atual_lng,
        });
      }
    });
  }, [navigate]);

  // Autocomplete de cidade (com debounce) — só busca se o texto digitado ainda não bate com a cidade já selecionada.
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

  function selecionarCidade(m: Municipio) {
    setCidadeSelecionada(m);
    setCidadeTexto(`${m.nome}/${m.uf}`);
    setSugestoesCidade([]);
    if (userId) salvarCidadeAtual(userId, m.nome, m.uf, m.latitude, m.longitude);
  }

  useEffect(() => {
    const filtros: FiltrosFrete = {
      destinoUf: destinoUf || null,
      tipoVeiculo: soMeuTipo ? tipoVeiculoPerfil : null,
    };
    setCarregando(true);
    listarFretesAbertos(filtros).then((r) => {
      setFretes(r);
      setCarregando(false);
    });
  }, [destinoUf, soMeuTipo, tipoVeiculoPerfil]);

  const listaExibir = useMemo<FreteComDistancia[]>(() => {
    const comDistancia: FreteComDistancia[] = fretes.map((f) => ({
      ...f,
      distancia:
        cidadeSelecionada && f.origemLat != null && f.origemLng != null
          ? distanciaKm(cidadeSelecionada.latitude, cidadeSelecionada.longitude, f.origemLat, f.origemLng)
          : null,
    }));
    if (!cidadeSelecionada) return comDistancia;
    return comDistancia
      .filter((f) => f.distancia != null && f.distancia <= raioKm)
      .sort((a, b) => (a.distancia ?? 0) - (b.distancia ?? 0));
  }, [fretes, cidadeSelecionada, raioKm]);

  const semLocalizacao = cidadeSelecionada
    ? fretes.filter((f) => f.origemLat == null || f.origemLng == null).length
    : 0;

  return (
    <main className="tela">
      <header className="garagem-header">
        <div>
          <p className="garagem-eyebrow">Busca frete</p>
          <h1>Fretes disponíveis</h1>
        </div>
      </header>

      <button type="button" className="link-secundario" onClick={() => navigate('/')}>
        ← Voltar para a Garagem
      </button>

      <label>
        Minha cidade agora
        <input
          value={cidadeTexto}
          onChange={(e) => {
            setCidadeTexto(e.target.value);
            setCidadeSelecionada(null);
          }}
          placeholder="Ex.: Sinop/MT"
        />
      </label>
      {sugestoesCidade.length > 0 && (
        <ul className="sugestoes-box">
          {sugestoesCidade.map((m) => (
            <li key={`${m.nome}-${m.uf}`}>
              <button type="button" className="sugestao-item" onClick={() => selecionarCidade(m)}>
                {m.nome}/{m.uf}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="filtro-frete">
        {cidadeSelecionada && (
          <label>
            Raio de busca
            <select value={raioKm} onChange={(e) => setRaioKm(Number(e.target.value))}>
              {RAIOS_KM.map((r) => (
                <option key={r} value={r}>
                  até {r} km
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Destino
          <select value={destinoUf} onChange={(e) => setDestinoUf(e.target.value)}>
            <option value="">Todos os estados</option>
            {UFS_BRASIL.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </label>
        {tipoVeiculoPerfil && (
          <button
            type="button"
            className={soMeuTipo ? 'chip chip-ativo' : 'chip'}
            onClick={() => setSoMeuTipo((v) => !v)}
          >
            Só o meu veículo ({tipoVeiculoPerfil})
          </button>
        )}
      </div>

      {!cidadeSelecionada && (
        <p className="aviso">Informe sua cidade atual pra filtrar fretes por raio de distância.</p>
      )}
      {cidadeSelecionada && semLocalizacao > 0 && (
        <p className="aviso">
          {semLocalizacao} frete(s) sem localização cadastrada não entraram na comparação de distância.
        </p>
      )}

      {carregando ? (
        <p className="aviso">Carregando fretes...</p>
      ) : listaExibir.length === 0 ? (
        <p className="aviso">
          {cidadeSelecionada ? 'Nenhum frete dentro desse raio com esse filtro.' : 'Nenhum frete encontrado com esse filtro.'}
        </p>
      ) : (
        <ul className="lista-analises">
          {listaExibir.map((f) => {
            const compativel =
              !tipoVeiculoPerfil ||
              f.tiposVeiculoAceitos.length === 0 ||
              f.tiposVeiculoAceitos.includes(tipoVeiculoPerfil as TipoVeiculo);
            return (
              <li key={f.id} className="linha-analise-item">
                <div className="linha-analise">
                  <div>
                    <p className="linha-analise-rota">
                      {f.origemCidade}/{f.origemUf} → {f.destinoCidade}/{f.destinoUf}
                    </p>
                    <p className="linha-analise-detalhe">
                      {f.valorACombinar || f.valorFreteCentavos == null
                        ? 'Valor a combinar'
                        : fmtBRL(f.valorFreteCentavos / 100)}
                      {' · '}
                      {f.empresaNome}
                      {f.distancia != null ? ` · ${f.distancia.toFixed(0)} km` : ''}
                    </p>
                    {f.tiposVeiculoAceitos.length > 0 && (
                      <p className="linha-analise-detalhe">Aceita: {f.tiposVeiculoAceitos.join(', ')}</p>
                    )}
                  </div>
                  {tipoVeiculoPerfil && (
                    <span className={compativel ? 'badge-veredicto badge-bom' : 'badge-veredicto badge-ruim'}>
                      {compativel ? 'Compatível' : 'Não aceita meu veículo'}
                    </span>
                  )}
                </div>
                {f.contatoTelefone && (
                  <p className="contato-frete-linha">
                    <a href={`tel:${f.contatoTelefone.replace(/\D/g, '')}`}>Ligar</a>
                    {' · '}
                    <a
                      href={`https://wa.me/55${f.contatoTelefone.replace(/\D/g, '')}?text=${encodeURIComponent(
                        montarMensagemWhatsapp(f, nomeMotorista),
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
