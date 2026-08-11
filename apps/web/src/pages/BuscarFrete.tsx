// apps/web/src/pages/BuscarFrete.tsx
//
// "Busca frete" dentro do app do motorista — lê fretes_publicados
// (ver lib/fretesPublicados.ts e Docs/status-sessao.md, 11/08). Hoje a
// tabela só tem dado de teste importado da Fretebras; a tela não sabe
// disso (não filtra por dado_teste) — quando o portal de empresas nascer
// e passar a publicar fretes reais na mesma tabela, essa tela já mostra
// os dois juntos sem precisar mudar nada.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { fmtBRL } from '@rode/calc';
import { listarFretesAbertos, UFS_BRASIL, type FretePublicado, type FiltrosFrete } from '../lib/fretesPublicados';
import { carregarMotorista } from '../lib/motorista';
import { carregarPerfil } from '../lib/frete';

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

export default function BuscarFrete() {
  const navigate = useNavigate();
  const [nomeMotorista, setNomeMotorista] = useState<string | null>(null);
  const [meuTipoVeiculo, setMeuTipoVeiculo] = useState<string | null>(null);
  const [origemUf, setOrigemUf] = useState('');
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
      const [motorista, perfil] = await Promise.all([carregarMotorista(uid), carregarPerfil(uid)]);
      setNomeMotorista(primeiroNome(motorista?.nome));
      setMeuTipoVeiculo(perfil?.tipo_veiculo ?? null);
    });
  }, [navigate]);

  useEffect(() => {
    const filtros: FiltrosFrete = {
      origemUf: origemUf || null,
      destinoUf: destinoUf || null,
      tipoVeiculo: soMeuTipo ? meuTipoVeiculo : null,
    };
    setCarregando(true);
    listarFretesAbertos(filtros).then((r) => {
      setFretes(r);
      setCarregando(false);
    });
  }, [origemUf, destinoUf, soMeuTipo, meuTipoVeiculo]);

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

      <div className="filtro-frete">
        <label>
          Origem
          <select value={origemUf} onChange={(e) => setOrigemUf(e.target.value)}>
            <option value="">Todos os estados</option>
            {UFS_BRASIL.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </label>
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
        {meuTipoVeiculo && (
          <button
            type="button"
            className={soMeuTipo ? 'chip chip-ativo' : 'chip'}
            onClick={() => setSoMeuTipo((v) => !v)}
          >
            Só o meu veículo ({meuTipoVeiculo})
          </button>
        )}
      </div>

      {carregando ? (
        <p className="aviso">Carregando fretes...</p>
      ) : fretes.length === 0 ? (
        <p className="aviso">Nenhum frete encontrado com esse filtro.</p>
      ) : (
        <ul className="lista-analises">
          {fretes.map((f) => (
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
                  </p>
                  {f.tiposVeiculoAceitos.length > 0 && (
                    <p className="linha-analise-detalhe">Aceita: {f.tiposVeiculoAceitos.join(', ')}</p>
                  )}
                </div>
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
          ))}
        </ul>
      )}
    </main>
  );
}
