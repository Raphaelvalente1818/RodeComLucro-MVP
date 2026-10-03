-- 02/10/2026 — "opção 3" do piso ANTT (decisão do Raphael): app e bot passam
-- a ler a tabela VIGENTE do banco em vez das constantes do código. As
-- constantes em packages/rode-calc/src/pisoANTT.ts e wa-webhook/calc.ts
-- viram fallback (offline / banco fora). Reajuste da ANTT = INSERT das linhas
-- novas em antt_piso_tabela com versao + vigencia_inicio; a troca acontece
-- sozinha na data, sem deploy. Cada cálculo grava `anttVersao` no snapshot.
--
-- Como cadastrar uma resolução nova (exemplo):
--   insert into public.antt_piso_tabela (tipo_carga, numero_eixos, ccd, cc, versao, fonte, vigencia_inicio)
--   values ('carga_geral', 5, 6.9000, 680.00, 'resolucao-XXXX-2027', 'Resolução ANTT Nº X.XXX/2027, Anexo II, Tabela A', '2027-01-20'), ...;
-- (todas as linhas de todos os tipos/eixos, mesma `versao`.)

create or replace function public.antt_piso_vigente(p_data date default current_date)
returns setof public.antt_piso_tabela
language sql
stable
security definer
set search_path = public
as $$
  select t.*
    from public.antt_piso_tabela t
   where t.versao = (
     select v.versao
       from public.antt_piso_tabela v
      where v.vigencia_inicio <= p_data
      order by v.vigencia_inicio desc, v.created_at desc
      limit 1
   )
   order by t.tipo_carga, t.numero_eixos;
$$;

grant execute on function public.antt_piso_vigente(date) to anon, authenticated, service_role;

comment on function public.antt_piso_vigente(date) is
  'Linhas da tabela ANTT (Tabela A) vigentes na data: a versão com maior vigencia_inicio <= p_data. Usada pelo app (lib/antt.ts) e pelo bot (wa-webhook) no boot; fallback são as constantes do código.';
