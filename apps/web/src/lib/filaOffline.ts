// apps/web/src/lib/filaOffline.ts
//
// Fila offline-first: quando uma gravação (salvar análise, marcar
// realizado, editar perfil/motorista, salvar cidade atual) falha por
// falta de conexão, ela é guardada localmente (IndexedDB) em vez de
// perder o dado ou travar a tela. Assim que a conexão volta (evento
// `online` do navegador, ou verificação periódica), a fila tenta enviar
// tudo pro Supabase sozinha, na ordem em que foi criada.
//
// Desenho pensado pra não criar dependência circular: este arquivo não
// sabe nada sobre `analise_frete`, `motoristas` etc. — cada módulo de
// domínio (lib/frete.ts, lib/motorista.ts) registra seu próprio
// "executor" via `registrarExecutor(tipo, fn)` na hora que é importado.
// A fila só guarda `{ tipo, payload }` e chama o executor certo na hora
// de sincronizar.
//
// Importante: todo write que passa por aqui precisa ser idempotente
// (upsert por id gerado no cliente, ou update por id/user_id) — se por
// algum motivo o mesmo item for reenviado duas vezes (ex: sincronizou e
// a resposta se perdeu antes de confirmar), reaplicar não pode duplicar
// nem corromper dado.

const DB_NOME = 'rode_fila_offline';
const DB_VERSAO = 1;
const STORE = 'itens';

export interface ItemFila<T = unknown> {
  idFila: string;
  tipo: string;
  payload: T;
  criadoEm: string;
  tentativas: number;
  ultimoErro: string | null;
}

type Executor = (payload: unknown) => Promise<{ error: string | null }>;

const executores = new Map<string, Executor>();

/** Cada módulo de domínio chama isso uma vez, na carga do módulo, pra ensinar a fila a reenviar seu tipo de gravação. */
export function registrarExecutor<T>(tipo: string, executor: (payload: T) => Promise<{ error: string | null }>): void {
  executores.set(tipo, executor as Executor);
}

const suportado = typeof indexedDB !== 'undefined';

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, DB_VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'idFila' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function listarItens(): Promise<ItemFila[]> {
  if (!suportado) return [];
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as ItemFila[]).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)));
    req.onerror = () => reject(req.error);
  });
}

async function salvarItem(item: ItemFila): Promise<void> {
  if (!suportado) return;
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function removerItem(idFila: string): Promise<void> {
  if (!suportado) return;
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(idFila);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Dispara sempre que a fila muda (item entra/sai) — Garagem.tsx escuta isso pra atualizar o aviso de pendência sem precisar dar F5. */
function avisarMudanca() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rode:fila-offline-mudou'));
  }
}

export async function contarPendentes(): Promise<number> {
  return (await listarItens()).length;
}

/**
 * Executa a gravação agora; se falhar por falta de rede (não por um erro
 * real do servidor, tipo RLS/validação), guarda na fila em vez de propagar
 * o erro pro chamador. `idFila`, quando informado, reaproveita o id da
 * gravação de verdade (ex: o uuid da análise) — assim reenviar depois
 * sobrescreve o mesmo registro em vez de criar um novo se, por acaso, a
 * tentativa direta já tiver ido parcialmente adiante.
 */
export async function gravarOuEnfileirar<T>(
  tipo: string,
  payload: T,
  idFila?: string,
): Promise<{ error: string | null; enfileirado: boolean }> {
  const executor = executores.get(tipo);
  if (!executor) {
    // eslint-disable-next-line no-console
    console.error('gravarOuEnfileirar: nenhum executor registrado pro tipo', tipo);
    return { error: 'Erro interno (tipo de gravação não reconhecido).', enfileirado: false };
  }

  const online = typeof navigator === 'undefined' || navigator.onLine;
  if (online) {
    try {
      const { error } = await executor(payload);
      // error aqui é uma resposta de verdade do Supabase (RLS, validação
      // etc.) — não adianta reenviar depois, é um erro real, propaga.
      if (!error) return { error: null, enfileirado: false };
      // eslint-disable-next-line no-console
      console.error('gravarOuEnfileirar: servidor recusou', tipo, error);
      return { error, enfileirado: false };
    } catch {
      // exceção (fetch falhou) = problema de rede, não erro de servidor — enfileira.
    }
  }

  const item: ItemFila<T> = {
    idFila: idFila ?? crypto.randomUUID(),
    tipo,
    payload,
    criadoEm: new Date().toISOString(),
    tentativas: 0,
    ultimoErro: null,
  };
  await salvarItem(item);
  avisarMudanca();
  return { error: null, enfileirado: true };
}

let sincronizando = false;

/** Tenta enviar tudo que está na fila, na ordem de criação. Para num item se ele falhar de novo (evita gastar tentativa de item mais novo fora de ordem), mas segue tentando os outros tipos independentes na próxima rodada. */
export async function processarFila(): Promise<void> {
  if (!suportado || sincronizando) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  sincronizando = true;
  try {
    const itens = await listarItens();
    if (itens.length === 0) return;
    let algumRemovido = false;
    for (const item of itens) {
      const executor = executores.get(item.tipo);
      if (!executor) continue; // tipo desconhecido (versão antiga do app?) — não trava a fila, só ignora.
      try {
        const { error } = await executor(item.payload);
        if (!error) {
          await removerItem(item.idFila);
          algumRemovido = true;
        } else {
          // Erro real do servidor (RLS, validação, sessão expirada...) —
          // não some com o dado do motorista por causa disso: mantém na
          // fila (com o motivo registrado) e tenta de novo na próxima
          // rodada. Preferível a descartar silenciosamente uma análise
          // que ele já achou que tinha "salvo".
          // eslint-disable-next-line no-console
          console.error('processarFila: item continua na fila após erro do servidor', item.tipo, error);
          await salvarItem({ ...item, tentativas: item.tentativas + 1, ultimoErro: error });
        }
      } catch {
        // Ainda sem rede (ou instável) — mantém na fila, incrementa tentativa, tenta o resto.
        await salvarItem({ ...item, tentativas: item.tentativas + 1, ultimoErro: 'Falha de conexão' });
      }
    }
    if (algumRemovido) avisarMudanca();
  } finally {
    sincronizando = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void processarFila();
  });
  // Tenta sincronizar assim que o app carrega (cobre o caso de ter fechado
  // o navegador offline com item pendente e reaberto já com conexão).
  void processarFila();
  // Verificação periódica — o evento 'online' nem sempre dispara de forma
  // confiável (ex: conexão instável que nunca "cai" de vez do ponto de
  // vista do navegador, mas as requisições reais falham).
  setInterval(() => {
    void processarFila();
  }, 30000);
}
