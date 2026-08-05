// packages/rode-calc/src/caminhoes.ts
//
// Catálogo de marcas/modelos de caminhão para autocomplete no cadastro
// do caminhão (Perfil.tsx): o motorista digita a marca, escolhe nas
// sugestões, digita o modelo (já filtrado pela marca) e o app preenche
// sozinho o consumo de diesel/ARLA de referência — editável depois.
//
// Origem: extraído de github.com/emerson1001a/calculadora-experimental
// (src/data/caminhoes.ts), sem alterações nos valores — são estimativas
// de referência por modelo, não medições, então o motorista sempre pode
// sobrescrever. `categoria` também alimenta o ajuste automático de
// manutenção por idade do veículo em Perfil.tsx (ver calcularFrete.ts
// para o resto do motor).
//
// Nota: no app original, o ano do caminhão NÃO filtrava os modelos
// disponíveis (a sugestão de modelo depende só da marca) — ele entrava
// numa conta separada de depreciação/manutenção por idade do veículo.
// Mantido assim aqui.

export interface ModeloCaminhao {
  modelo: string;
  consumoDieselKmL: number;
  consumoArlaKmL: number | null;
  categoria: 'pesado' | 'semipesado' | 'medio_leve';
}

export const caminhoes: Record<string, ModeloCaminhao[]> = {
  "Volvo": [
    { modelo: "FH 460", consumoDieselKmL: 2.8, consumoArlaKmL: 56, categoria: 'pesado' },
    { modelo: "FH 500", consumoDieselKmL: 2.7, consumoArlaKmL: 54, categoria: 'pesado' },
    { modelo: "FH 540", consumoDieselKmL: 2.6, consumoArlaKmL: 52, categoria: 'pesado' },
    { modelo: "FM 370", consumoDieselKmL: 3.0, consumoArlaKmL: 60, categoria: 'pesado' },
    { modelo: "FM 420", consumoDieselKmL: 2.9, consumoArlaKmL: 58, categoria: 'pesado' },
    { modelo: "FM 460", consumoDieselKmL: 2.8, consumoArlaKmL: 56, categoria: 'pesado' },
    { modelo: "FMX 370", consumoDieselKmL: 2.7, consumoArlaKmL: 54, categoria: 'pesado' },
    { modelo: "FMX 420", consumoDieselKmL: 2.6, consumoArlaKmL: 52, categoria: 'pesado' },
    { modelo: "FMX 460", consumoDieselKmL: 2.5, consumoArlaKmL: 50, categoria: 'pesado' },
    { modelo: "VM 270", consumoDieselKmL: 3.5, consumoArlaKmL: 70, categoria: 'semipesado' },
    { modelo: "VM 290", consumoDieselKmL: 3.4, consumoArlaKmL: 68, categoria: 'semipesado' },
    { modelo: "VM 330", consumoDieselKmL: 3.2, consumoArlaKmL: 64, categoria: 'semipesado' },
    { modelo: "VM 360", consumoDieselKmL: 3.0, consumoArlaKmL: 60, categoria: 'semipesado' },
  ],
  "Scania": [
    { modelo: "R 450", consumoDieselKmL: 2.8, consumoArlaKmL: 56, categoria: 'pesado' },
    { modelo: "R 460", consumoDieselKmL: 2.7, consumoArlaKmL: 54, categoria: 'pesado' },
    { modelo: "R 500", consumoDieselKmL: 2.6, consumoArlaKmL: 52, categoria: 'pesado' },
    { modelo: "R 540", consumoDieselKmL: 2.5, consumoArlaKmL: 50, categoria: 'pesado' },
    { modelo: "R 560", consumoDieselKmL: 2.4, consumoArlaKmL: 48, categoria: 'pesado' },
    { modelo: "S 450", consumoDieselKmL: 2.9, consumoArlaKmL: 58, categoria: 'pesado' },
    { modelo: "S 500", consumoDieselKmL: 2.7, consumoArlaKmL: 54, categoria: 'pesado' },
    { modelo: "S 540", consumoDieselKmL: 2.6, consumoArlaKmL: 52, categoria: 'pesado' },
    { modelo: "S 560", consumoDieselKmL: 2.5, consumoArlaKmL: 50, categoria: 'pesado' },
    { modelo: "P 360", consumoDieselKmL: 3.2, consumoArlaKmL: 64, categoria: 'semipesado' },
    { modelo: "P 400", consumoDieselKmL: 3.0, consumoArlaKmL: 60, categoria: 'semipesado' },
    { modelo: "P 420", consumoDieselKmL: 2.9, consumoArlaKmL: 58, categoria: 'semipesado' },
    { modelo: "G 410", consumoDieselKmL: 3.0, consumoArlaKmL: 60, categoria: 'pesado' },
    { modelo: "G 450", consumoDieselKmL: 2.8, consumoArlaKmL: 56, categoria: 'pesado' },
  ],
  "Mercedes-Benz": [
    { modelo: "Actros 2546", consumoDieselKmL: 2.7, consumoArlaKmL: 54, categoria: 'pesado' },
    { modelo: "Actros 2651", consumoDieselKmL: 2.5, consumoArlaKmL: 50, categoria: 'pesado' },
    { modelo: "Actros 2658", consumoDieselKmL: 2.4, consumoArlaKmL: 48, categoria: 'pesado' },
    { modelo: "Axor 2533", consumoDieselKmL: 2.8, consumoArlaKmL: 56, categoria: 'pesado' },
    { modelo: "Axor 2544", consumoDieselKmL: 2.7, consumoArlaKmL: 54, categoria: 'pesado' },
    { modelo: "Atego 1719", consumoDieselKmL: 4.0, consumoArlaKmL: 80, categoria: 'semipesado' },
    { modelo: "Atego 1726", consumoDieselKmL: 3.8, consumoArlaKmL: 76, categoria: 'semipesado' },
    { modelo: "Atego 2425", consumoDieselKmL: 3.2, consumoArlaKmL: 64, categoria: 'semipesado' },
    { modelo: "Atego 2430", consumoDieselKmL: 3.0, consumoArlaKmL: 60, categoria: 'semipesado' },
    { modelo: "Accelo 1017", consumoDieselKmL: 5.0, consumoArlaKmL: 100, categoria: 'medio_leve' },
    { modelo: "Accelo 1316", consumoDieselKmL: 4.5, consumoArlaKmL: 90, categoria: 'medio_leve' },
  ],
  "Volkswagen": [
    { modelo: "Meteor 28.480", consumoDieselKmL: 2.7, consumoArlaKmL: 54, categoria: 'pesado' },
    { modelo: "Meteor 29.530", consumoDieselKmL: 2.5, consumoArlaKmL: 50, categoria: 'pesado' },
    { modelo: "Constellation 14.210", consumoDieselKmL: 4.5, consumoArlaKmL: 90, categoria: 'semipesado' },
    { modelo: "Constellation 17.210", consumoDieselKmL: 4.0, consumoArlaKmL: 80, categoria: 'semipesado' },
    { modelo: "Constellation 18.260", consumoDieselKmL: 3.8, consumoArlaKmL: 76, categoria: 'semipesado' },
    { modelo: "Constellation 18.320", consumoDieselKmL: 3.5, consumoArlaKmL: 70, categoria: 'semipesado' },
    { modelo: "Constellation 19.380", consumoDieselKmL: 3.2, consumoArlaKmL: 64, categoria: 'pesado' },
    { modelo: "Constellation 20.480", consumoDieselKmL: 2.9, consumoArlaKmL: 58, categoria: 'pesado' },
    { modelo: "Constellation 25.480", consumoDieselKmL: 2.8, consumoArlaKmL: 56, categoria: 'pesado' },
    { modelo: "Constellation 26.320", consumoDieselKmL: 3.0, consumoArlaKmL: 60, categoria: 'pesado' },
    { modelo: "Constellation 26.480", consumoDieselKmL: 2.8, consumoArlaKmL: 56, categoria: 'pesado' },
    { modelo: "Delivery 6.160", consumoDieselKmL: 6.0, consumoArlaKmL: 120, categoria: 'medio_leve' },
    { modelo: "Delivery 9.180", consumoDieselKmL: 5.0, consumoArlaKmL: 100, categoria: 'medio_leve' },
    { modelo: "Delivery 11.180", consumoDieselKmL: 4.5, consumoArlaKmL: 90, categoria: 'medio_leve' },
  ],
  "DAF": [
    { modelo: "XF 480", consumoDieselKmL: 2.8, consumoArlaKmL: 56, categoria: 'pesado' },
    { modelo: "XF 530", consumoDieselKmL: 2.6, consumoArlaKmL: 52, categoria: 'pesado' },
    { modelo: "CF 400", consumoDieselKmL: 3.0, consumoArlaKmL: 60, categoria: 'semipesado' },
    { modelo: "CF 450", consumoDieselKmL: 2.9, consumoArlaKmL: 58, categoria: 'semipesado' },
  ],
  "Iveco": [
    { modelo: "S-Way 480", consumoDieselKmL: 2.8, consumoArlaKmL: 56, categoria: 'pesado' },
    { modelo: "S-Way 530", consumoDieselKmL: 2.6, consumoArlaKmL: 52, categoria: 'pesado' },
    { modelo: "Hi-Way 480", consumoDieselKmL: 2.9, consumoArlaKmL: 58, categoria: 'pesado' },
    { modelo: "Tector 240", consumoDieselKmL: 3.5, consumoArlaKmL: 70, categoria: 'semipesado' },
    { modelo: "Tector 270", consumoDieselKmL: 3.3, consumoArlaKmL: 66, categoria: 'semipesado' },
    { modelo: "Tector 320", consumoDieselKmL: 3.0, consumoArlaKmL: 60, categoria: 'semipesado' },
    { modelo: "Daily 35-150", consumoDieselKmL: 7.0, consumoArlaKmL: null, categoria: 'medio_leve' },
    { modelo: "Daily 40-150", consumoDieselKmL: 6.5, consumoArlaKmL: null, categoria: 'medio_leve' },
    { modelo: "Daily 55-170", consumoDieselKmL: 6.0, consumoArlaKmL: null, categoria: 'medio_leve' },
  ],
  "MAN": [
    { modelo: "TGX 28.480", consumoDieselKmL: 2.7, consumoArlaKmL: 54, categoria: 'pesado' },
    { modelo: "TGX 33.480", consumoDieselKmL: 2.5, consumoArlaKmL: 50, categoria: 'pesado' },
    { modelo: "TGS 26.480", consumoDieselKmL: 2.8, consumoArlaKmL: 56, categoria: 'pesado' },
    { modelo: "TGS 33.360", consumoDieselKmL: 3.0, consumoArlaKmL: 60, categoria: 'pesado' },
    { modelo: "TGM 15.250", consumoDieselKmL: 3.8, consumoArlaKmL: 76, categoria: 'semipesado' },
    { modelo: "TGM 18.250", consumoDieselKmL: 3.5, consumoArlaKmL: 70, categoria: 'semipesado' },
  ],
  "Ford": [
    { modelo: "Cargo 1723", consumoDieselKmL: 4.0, consumoArlaKmL: 80, categoria: 'medio_leve' },
    { modelo: "Cargo 2429", consumoDieselKmL: 3.2, consumoArlaKmL: 64, categoria: 'semipesado' },
    { modelo: "Cargo 2842", consumoDieselKmL: 2.9, consumoArlaKmL: 58, categoria: 'semipesado' },
  ],
};

export const marcas = Object.keys(caminhoes).sort();
