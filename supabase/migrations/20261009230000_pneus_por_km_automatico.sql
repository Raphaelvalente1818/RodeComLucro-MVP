-- Pneus por eixo (09/10/2026, decisão do Raphael — item da auditoria de 08/10).
-- pneus_por_km passa a aceitar NULL = "automático": o motor calcula pelo
-- número de eixos do conjunto (2 pneus na direção + 4 por eixo restante,
-- carcaça novo+recapagens ÷ km de vida — ver packages/rode-calc/src/pneus.ts).
-- Se o motorista preencher o campo, o valor dele vence.
-- Em 09/10 os 24 perfis estavam no 0,12 padrão (ninguém editou) → viram NULL.

alter table public.caminhao_perfil
  alter column pneus_por_km drop not null,
  alter column pneus_por_km drop default;

update public.caminhao_perfil set pneus_por_km = null where pneus_por_km = 0.120;

comment on column public.caminhao_perfil.pneus_por_km is
  'R$/km de pneus. NULL = automático pelo número de eixos (pneusPorKmPadrao em @rode/calc). Preenchido = valor do motorista vence.';
