// apps/web/src/lib/cacheLocal.ts
//
// Cache local simples (localStorage) da última cópia de uma leitura do
// Supabase — resolve o problema inverso da fila offline (filaOffline.ts):
// lá é sobre não perder o que o motorista tenta ESCREVER sem sinal; aqui
// é sobre ter algo pra mostrar/usar quando ele tenta LER sem sinal (ex:
// abrir a calculadora já sem internet e ainda assim usar os custos reais
// do caminhão dele, não um valor padrão genérico).
//
// Deliberadamente simples: só a leitura mais recente, sobrescrita a cada
// sucesso — não é um cache de várias versões nem tem expiração. Se o
// motorista editar o perfil em outro aparelho enquanto este está offline,
// o cache local fica desatualizado até a próxima leitura online (aceitável
// pro tamanho do app hoje).

const PREFIXO = 'rode_cache_';

export function salvarCache<T>(chave: string, valor: T): void {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  } catch {
    // localStorage indisponível ou cheio — sem cache dessa vez, sem quebrar o app por causa disso.
  }
}

export function lerCache<T>(chave: string): T | null {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}
