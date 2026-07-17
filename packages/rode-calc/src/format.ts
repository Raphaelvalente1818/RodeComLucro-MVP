// Formatação e conversão de unidade compartilhadas por todos os canais
// (app, WhatsApp). Mantém a regra do PRD: o motor (`calcularFrete`) opera
// em REAIS; qualquer persistência em centavos passa por estas duas
// fronteiras explícitas, nunca por conversão implícita.

export function fmtBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

export function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Centavos inteiros (o que o banco persiste) → reais (o que o motor consome). */
export function centsToReais(cents: number): number {
  return cents / 100;
}

/** Reais (saída do motor) → centavos inteiros (o que o banco persiste). Arredonda para o centavo mais próximo. */
export function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Faz o parse de um número digitado em formato pt-BR ('1.500,00' ou '150,00')
 * ou neutro ('150.00'), tolerante a texto vazio/inválido (retorna 0).
 * Extraído de calculadora-experimental (src/utils/format.ts).
 */
export function parseNumeroPtBR(text: string): number {
  if (!text) return 0;
  const cleaned = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
