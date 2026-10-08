-- Reajuste do piso ANTT — Portaria SUROC nº 22, de 28/09/2026 (DOU 29/09/2026,
-- Edição Extra 1-A), em vigor em 30/09/2026. Gatilho do diesel (§3º art. 5º da
-- Lei 13.703/2018): Pcomb R$ 6,97 → R$ 7,33/L (ANP, 20–26/09). Reajusta os
-- coeficientes do Anexo II da Resolução 5.867/2020 — só o CCD (R$/km) muda;
-- o CC (carga e descarga) ficou igual ao da Resolução 6.084/2026.
--
-- Fonte conferida linha a linha em 08/10/2026 no texto oficial:
-- https://anttlegis.antt.gov.br/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=POR&numeroAto=00000022&seqAto=000&valorAno=2026&orgao=SUROC%2FANTT%2FMT&cod_modulo=623&cod_menu=9230
-- Tabela A (carga lotação, composição veicular ou caminhão simples), só os 5
-- tipos que o app usa. Conteinerizada não tem 2 eixos (nota do anexo).
--
-- app (lib/antt.ts) e bot (garantirTabelaANTT) passam a usar esta versão
-- sozinhos via antt_piso_vigente(); constantes de fallback atualizadas em
-- packages/rode-calc/src/pisoANTT.ts e wa-webhook/calc.ts.

insert into public.antt_piso_tabela (tipo_carga, numero_eixos, ccd, cc, versao, fonte, vigencia_inicio)
select t.tipo_carga, t.numero_eixos, t.ccd, t.cc,
       'portaria-suroc-22-2026',
       'Portaria SUROC Nº 22/2026 (reajusta Anexo II da Resolução ANTT 5.867/2020), Tabela A, DOU 29/09/2026 Ed. Extra',
       date '2026-09-30'
from (values
  ('granel_solido', 2, 4.1056, 460.59),
  ('granel_solido', 3, 5.2555, 552.24),
  ('granel_solido', 4, 5.9476, 597.00),
  ('granel_solido', 5, 6.8548, 664.83),
  ('granel_solido', 6, 7.5641, 680.01),
  ('granel_solido', 7, 8.2316, 820.34),
  ('granel_solido', 9, 9.4318, 908.91),

  ('granel_liquido', 2, 4.1796, 471.98),
  ('granel_liquido', 3, 5.3511, 569.57),
  ('granel_liquido', 4, 6.1019, 621.52),
  ('granel_liquido', 5, 7.0226, 693.08),
  ('granel_liquido', 6, 7.7372, 709.72),
  ('granel_liquido', 7, 8.3700, 840.50),
  ('granel_liquido', 9, 9.5909, 934.76),

  ('frigorificada', 2, 4.8234, 520.07),
  ('frigorificada', 3, 6.1659, 623.27),
  ('frigorificada', 4, 7.0345, 686.63),
  ('frigorificada', 5, 8.0623, 757.98),
  ('frigorificada', 6, 8.8911, 772.35),
  ('frigorificada', 7, 9.8134, 982.76),
  ('frigorificada', 9, 11.1479, 1067.06),

  ('conteinerizada', 3, 5.2282, 544.75),
  ('conteinerizada', 4, 5.8755, 577.15),
  ('conteinerizada', 5, 6.7910, 647.29),
  ('conteinerizada', 6, 7.4986, 662.01),
  ('conteinerizada', 7, 8.2292, 819.69),
  ('conteinerizada', 9, 9.3486, 886.05),

  ('carga_geral', 2, 4.0738, 451.84),
  ('carga_geral', 3, 5.2177, 541.86),
  ('carga_geral', 4, 5.9180, 588.86),
  ('carga_geral', 5, 6.8284, 657.56),
  ('carga_geral', 6, 7.5347, 671.93),
  ('carga_geral', 7, 8.2727, 831.66),
  ('carga_geral', 9, 9.4114, 903.32)
) as t(tipo_carga, numero_eixos, ccd, cc)
where not exists (
  select 1 from public.antt_piso_tabela x
   where x.versao = 'portaria-suroc-22-2026' and x.tipo_carga = t.tipo_carga and x.numero_eixos = t.numero_eixos
);
