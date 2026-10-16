-- Geolocaliza a origem dos fretes novos (mesmo join de 11/08: nome_norm + unaccent) e confere os totais.
update public.fretes_publicados f
set origem_lat = m.latitude, origem_lng = m.longitude
from public.municipios_brasil m
where f.origem_lat is null
  and m.uf = trim(f.origem_uf)
  and m.nome_norm = lower(public.unaccent(trim(f.origem_cidade)));

select fonte, status, count(*) as fretes, count(origem_lat) as com_geo, min(anunciado_em)::date as de, max(anunciado_em)::date as ate
from public.fretes_publicados group by 1,2 order by 3 desc;
select count(*) as empresas_fretebras from public.empresas_fretebras;
