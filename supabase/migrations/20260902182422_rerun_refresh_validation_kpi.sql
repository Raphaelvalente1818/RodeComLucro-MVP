-- A correção anterior (20260902182408) foi aplicada junto com outras
-- chamadas na mesma transação MCP; quando uma instrução posterior falhou,
-- o Postgres desfez a transação inteira, incluindo duas chamadas de
-- refresh que já tinham funcionado antes do erro. Este arquivo só
-- re-executa essas duas, agora que o bug de ambiguidade está corrigido —
-- não muda nenhum schema, só popula agg_validation e agg_kpi_daily com o
-- snapshot do dia.
select public.refresh_agg_validation();
select public.refresh_agg_kpi_diario();
