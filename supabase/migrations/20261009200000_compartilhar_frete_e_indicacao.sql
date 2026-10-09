-- 09/10/2026 — "Compartilhar frete com um colega" + código de indicação
-- (Docs/status-sessao.md 09/10; pedido do Raphael: o colega toca no link, entra
-- no WhatsApp do bot com "FRETE <código> #<quem indicou>" preenchido, a conta
-- nasce e o frete chega calculado).
--
-- 1. fretes_publicados.codigo — 5 caracteres, sem I/L/O/0/1 (legível em tela
--    de celular e em voz), único, gerado por trigger. É o que vai no link.
-- 2. motoristas.codigo_indicacao — coluna já existia desde 24/09 mas nunca foi
--    preenchida (0/31). Agora: 6 caracteres, gerado por trigger e backfill.
-- 3. indicacao — quem trouxe quem, por qual frete; base da aba "Funil viral".

create or replace function public.gerar_codigo(n int)
returns text
language sql
volatile
as $$
  -- alfabeto sem caracteres ambíguos (I, L, O, 0, 1)
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
    from generate_series(1, n);
$$;

-- ---------- 1. código curto do frete ----------
alter table public.fretes_publicados add column if not exists codigo text;
create unique index if not exists fretes_publicados_codigo_idx on public.fretes_publicados (codigo);

create or replace function public.fretes_publicados_codigo()
returns trigger language plpgsql as $$
begin
  if new.codigo is null then
    loop
      new.codigo := public.gerar_codigo(5);
      exit when not exists (select 1 from public.fretes_publicados f where f.codigo = new.codigo);
    end loop;
  end if;
  return new;
end; $$;
drop trigger if exists fretes_publicados_codigo on public.fretes_publicados;
create trigger fretes_publicados_codigo before insert on public.fretes_publicados
  for each row execute function public.fretes_publicados_codigo();

-- backfill dos existentes (um a um, pra respeitar o índice único)
do $$
declare r record; c text;
begin
  for r in select id from public.fretes_publicados where codigo is null loop
    loop
      c := public.gerar_codigo(5);
      exit when not exists (select 1 from public.fretes_publicados f where f.codigo = c);
    end loop;
    update public.fretes_publicados set codigo = c where id = r.id;
  end loop;
end $$;

-- ---------- 2. código de indicação do motorista ----------
create unique index if not exists motoristas_codigo_indicacao_idx on public.motoristas (codigo_indicacao);

create or replace function public.motoristas_codigo_indicacao()
returns trigger language plpgsql as $$
begin
  if new.codigo_indicacao is null then
    loop
      new.codigo_indicacao := public.gerar_codigo(6);
      exit when not exists (select 1 from public.motoristas m where m.codigo_indicacao = new.codigo_indicacao);
    end loop;
  end if;
  return new;
end; $$;
drop trigger if exists motoristas_codigo_indicacao on public.motoristas;
create trigger motoristas_codigo_indicacao before insert on public.motoristas
  for each row execute function public.motoristas_codigo_indicacao();

do $$
declare r record; c text;
begin
  for r in select id from public.motoristas where codigo_indicacao is null loop
    loop
      c := public.gerar_codigo(6);
      exit when not exists (select 1 from public.motoristas m where m.codigo_indicacao = c);
    end loop;
    update public.motoristas set codigo_indicacao = c where id = r.id;
  end loop;
end $$;

-- ---------- 3. quem trouxe quem ----------
create table if not exists public.indicacao (
  id uuid primary key default gen_random_uuid(),
  indicador_id uuid references public.motoristas (id) on delete set null,
  indicador_codigo text not null,
  indicado_id uuid not null references public.motoristas (id) on delete cascade,
  frete_id uuid references public.fretes_publicados (id) on delete set null,
  origem text not null check (origem in ('frete', 'cartao', 'link')),
  created_at timestamptz not null default now(),
  unique (indicado_id)  -- cada motorista só é "trazido" uma vez (a primeira)
);
alter table public.indicacao enable row level security;
drop policy if exists indicacao_admin_le on public.indicacao;
create policy indicacao_admin_le on public.indicacao
  for select to authenticated using (public.is_admin_ativo());
-- escrita só pelo service_role (wa-webhook)
