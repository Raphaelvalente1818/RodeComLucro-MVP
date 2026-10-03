-- 03/10/2026 — corretor de cidade pro bot (caso "coruipe" → Coruripe/AL).
-- Antes de chamar o Google Routes, o wa-webhook casa o que o motorista
-- escreveu com municipios_brasil por similaridade de trigramas. Devolve os
-- melhores candidatos com um score 0..1; o bot decide: usa direto se tiver
-- certeza, pergunta com botão se não, avisa se não achou nada parecido.
create extension if not exists pg_trgm with schema extensions;

create index if not exists municipios_brasil_nome_norm_trgm
  on public.municipios_brasil using gin (nome_norm extensions.gin_trgm_ops);

-- Normaliza do mesmo jeito que nome_norm foi gerado: sem acento, minúsculo,
-- espaços simples. Aceita "cidade/UF", "cidade - UF", "cidade UF".
create or replace function public.municipio_sugerir(p_texto text, p_limite int default 3)
returns table (nome text, uf text, latitude numeric, longitude numeric, similaridade real)
language plpgsql stable
as $$
declare
  v_txt text := lower(trim(public.unaccent(coalesce(p_texto, ''))));  -- unaccent está em public neste projeto
  v_uf text := null;
  v_nome text;
  m text[];
begin
  v_txt := regexp_replace(v_txt, '[.,;:!?]+$', '');
  v_txt := regexp_replace(v_txt, '\s+', ' ', 'g');
  -- "coruripe/al", "coruripe - al", "coruripe al"
  m := regexp_match(v_txt, '^(.+?)\s*(?:[/\-–,]\s*|\s+)([a-z]{2})$');
  if m is not null and upper(m[2]) in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') then
    v_nome := trim(m[1]);
    v_uf := upper(m[2]);
  else
    v_nome := v_txt;
  end if;
  if v_nome = '' then
    return;
  end if;

  return query
  select mb.nome, mb.uf, mb.latitude, mb.longitude,
         case when mb.nome_norm = v_nome then 1.0::real
              else extensions.similarity(mb.nome_norm, v_nome) end as similaridade
  from public.municipios_brasil mb
  where (v_uf is null or mb.uf = v_uf)
    and (mb.nome_norm = v_nome or mb.nome_norm % v_nome)
  order by similaridade desc, mb.nome_norm
  limit greatest(1, p_limite);
end;
$$;

grant execute on function public.municipio_sugerir(text, int) to anon, authenticated, service_role;

-- Limiar padrão do pg_trgm é 0.3; "coruipe" vs "coruripe" dá ~0.6.
-- Status novo em wa_freight_query: o bot perguntou "é Coruripe/AL?" e está
-- esperando o toque no botão (extracao_snapshot guarda o pedido inteiro).
alter table public.wa_freight_query
  drop constraint if exists wa_freight_query_status_check;

alter table public.wa_freight_query
  add constraint wa_freight_query_status_check check (status = any (array[
    'calculado', 'confirmacao_pendente', 'dado_faltando', 'erro_extracao',
    'nao_vinculado', 'calculado_anonimo', 'nao_cadastrado', 'calculado_novo',
    'boas_vindas', 'onboarding_resposta', 'recalculado_perfil', 'sair',
    'resposta_livre', 'limite_diario', 'busca_sem_resultado', 'busca_origem',
    'cotado', 'pergunta_calculo', 'veiculo_salvo', 'cidade_pendente'
  ]::text[]));

comment on function public.municipio_sugerir is
  'Candidatos de município por similaridade de trigramas (bot WhatsApp). similaridade=1 é casamento exato de nome_norm.';
