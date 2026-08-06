-- =====================================================================
-- caminhao_perfil: tipo_veiculo + tipo_carroceria
--
-- Importado da calculadora-experimental do Emerson (ver
-- packages/rode-calc/src/tiposCaminhao.ts). Hoje é só perfil/UX — sugere
-- numeroEixos ao escolher a carroceria no Perfil.tsx. O piso ANTT
-- continua calculado só por numero_eixos (ver pisoANTT.ts); o TODO de
-- tabela ANTT por tipo de carga (granel/frigorificada/conteinerizada)
-- continua em aberto, esses campos só deixam a base pronta pra isso.
-- =====================================================================

alter table public.caminhao_perfil
  add column if not exists tipo_veiculo text,
  add column if not exists tipo_carroceria text;

alter table public.caminhao_perfil
  add constraint caminhao_perfil_tipo_veiculo_check check (
    tipo_veiculo is null or tipo_veiculo in (
      'Carreta','Carreta LS','Vanderléia','Carreta 4º eixo','Bitrem 7 eixos','Bitrem 9 eixos','Rodotrem',
      'Truck','BiTruck',
      'Fiorino','VLC','3/4','Toco'
    )
  );

alter table public.caminhao_perfil
  add constraint caminhao_perfil_tipo_carroceria_check check (
    tipo_carroceria is null or tipo_carroceria in (
      'Graneleiro','Grade baixa','Prancha','Caçamba','Plataforma',
      'Sider','Baú','Baú Frigorífico','Baú Refrigerado',
      'Silo','Cegonheiro','Gaiola','Tanque','Bug Porta Container','Munk','Apenas Cavalo','Cavaqueira','Hoper'
    )
  );
