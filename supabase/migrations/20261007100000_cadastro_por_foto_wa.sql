-- 07/10/2026 — Bot WhatsApp: cadastro por foto (CNH + CRLV). Textos e regras
-- em Docs/bot-cadastro-por-foto.md. O bot lê a foto com IA (visão), mostra o
-- que leu, grava SÓ os campos abaixo e descarta a imagem. Nunca grava CPF,
-- RG, nascimento, chassi nem proprietário do CRLV. Nome que vale é o da CNH.

-- 1. Campos novos
alter table public.motoristas
  add column if not exists cnh_categoria text check (cnh_categoria is null or cnh_categoria ~ '^(A|B|C|D|E|AB|AC|AD|AE)$');

alter table public.caminhao_perfil
  add column if not exists placa text check (placa is null or placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  add column if not exists renavam text check (renavam is null or renavam ~ '^[0-9]{9,11}$'),
  add column if not exists crlv_exercicio int check (crlv_exercicio is null or crlv_exercicio between 2000 and 2100);

comment on column public.caminhao_perfil.crlv_exercicio is
  'Ano de exercício do último CRLV lido (licenciamento). Alerta de vencimento usa isso.';

-- 2. Consentimento pra leitura de documento (uma linha, antes da 1ª foto)
alter table public.consentimento
  drop constraint if exists consentimento_tipo_check;

alter table public.consentimento
  add constraint consentimento_tipo_check
  check (tipo in ('termos_uso','politica_privacidade','persistencia_historico','canal_whatsapp','leitura_documento'));

-- 3. Estado da conversa de cadastro por foto (uma linha por número; some ao
--    salvar/cancelar). `dados` guarda só o que foi extraído (os campos
--    permitidos), nunca a imagem. `media_id` é o id da mídia na Meta,
--    guardado só enquanto espera o consentimento (a Meta apaga em 30 dias;
--    a gente não baixa antes do "Pode ler").
create table if not exists public.wa_cadastro_foto (
  from_e164 text primary key,
  motorista_id uuid not null references public.motoristas(id) on delete cascade,
  etapa text not null check (etapa in ('aguardando_consentimento', 'aguardando_foto', 'confirmar', 'corrigir', 'tipo_veiculo')),
  tipo_doc text check (tipo_doc is null or tipo_doc in ('cnh', 'crlv')),
  dados jsonb,
  media_id text,
  convidado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wa_cadastro_foto enable row level security;
-- Só o service_role (webhook) mexe; nenhuma policy pra authenticated.

-- 4. Auditoria em wa_freight_query
alter table public.wa_freight_query
  drop constraint if exists wa_freight_query_status_check;

alter table public.wa_freight_query
  add constraint wa_freight_query_status_check check (status = any (array[
    'calculado', 'confirmacao_pendente', 'dado_faltando', 'erro_extracao',
    'nao_vinculado', 'calculado_anonimo', 'nao_cadastrado', 'calculado_novo',
    'boas_vindas', 'onboarding_resposta', 'recalculado_perfil', 'sair',
    'resposta_livre', 'limite_diario', 'busca_sem_resultado', 'busca_origem',
    'cotado', 'pergunta_calculo', 'veiculo_salvo', 'cidade_pendente',
    'doc_convite', 'doc_lido', 'doc_salvo', 'doc_cancelado', 'doc_ilegivel', 'doc_imagem_sem_contexto'
  ]::text[]));
