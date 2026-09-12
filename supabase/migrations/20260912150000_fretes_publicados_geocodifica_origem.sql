-- Preenche origem_lat/origem_lng automaticamente a partir de
-- municipios_brasil (cidade normalizada + UF) em todo INSERT/UPDATE de
-- fretes_publicados quando ainda estiver nulo. Antes isso era UPDATE
-- manual via execute_sql (ver 20260811160100) — fretes importados por
-- planilha ficavam sem coordenada e sumiam da busca por raio do
-- motorista (11 estavam assim em 12/09). Vale pra import do admin e
-- pro portal da empresa.
create or replace function public.fretes_publicados_geocodifica_origem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.origem_lat is null or new.origem_lng is null
     or (tg_op = 'UPDATE' and (new.origem_cidade is distinct from old.origem_cidade or new.origem_uf is distinct from old.origem_uf)) then
    select m.latitude, m.longitude
      into new.origem_lat, new.origem_lng
      from public.municipios_brasil m
     where m.uf = upper(new.origem_uf)
       and m.nome_norm = lower(unaccent(btrim(new.origem_cidade)))
     limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists fretes_publicados_geocodifica_origem_trg on public.fretes_publicados;
create trigger fretes_publicados_geocodifica_origem_trg
  before insert or update on public.fretes_publicados
  for each row execute function public.fretes_publicados_geocodifica_origem();

-- Backfill dos que estavam sem coordenada (6 de 11 resolvidos; os 5
-- restantes eram grafia fora do padrão — "d'Aliança" sem apóstrofo,
-- "Boa Esperança/MT" inexistente, e um "RibeirÃ£o" de teste com encoding
-- quebrado).
update public.fretes_publicados f
   set origem_lat = m.latitude, origem_lng = m.longitude
  from public.municipios_brasil m
 where f.origem_lat is null
   and m.uf = upper(f.origem_uf)
   and m.nome_norm = lower(unaccent(btrim(f.origem_cidade)));
