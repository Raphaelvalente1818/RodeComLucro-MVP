-- =====================================================================
-- otp-solicitar — escalada de nivel atomica pra otp_bloqueio
--
-- Bug corrigido: a função registrarBloqueio() no edge function fazia
-- SELECT nivel atual + UPSERT em duas chamadas separadas. Sob
-- concorrência (várias tentativas quase simultâneas, ex.: usuário
-- clicando reenviar repetidas vezes), múltiplas requests liam o mesmo
-- nivel antes de qualquer uma escrever, e cada uma escalava
-- nivel+1 a partir do mesmo ponto de partida — um usuário conseguia
-- pular de nível 1 (15min) pra nível 3 (24h) em poucos segundos.
--
-- Esta função resolve tudo em um único UPSERT: o cálculo do próximo
-- nível e do bloqueado_ate usa o valor da linha já commitada (via
-- alias da tabela dentro do próprio SET), e o lock de linha do
-- INSERT ... ON CONFLICT serializa automaticamente requests
-- concorrentes pra mesma chave.
-- =====================================================================

create or replace function public.registrar_bloqueio_otp(
  p_escopo text,
  p_chave text,
  p_motivo text
) returns timestamptz
language sql
security definer
set search_path to 'public'
as $$
  insert into public.otp_bloqueio as ob (escopo, chave, nivel, bloqueado_ate, motivo)
  values (p_escopo, p_chave, 1, now() + interval '15 minutes', p_motivo)
  on conflict (escopo, chave) do update
    set nivel = least(ob.nivel + 1, 3),
        bloqueado_ate = now() + (
          case least(ob.nivel + 1, 3)
            when 1 then interval '15 minutes'
            when 2 then interval '60 minutes'
            else interval '1440 minutes'
          end
        ),
        motivo = excluded.motivo
  returning bloqueado_ate;
$$;

grant execute on function public.registrar_bloqueio_otp(text, text, text) to service_role;
revoke execute on function public.registrar_bloqueio_otp(text, text, text) from authenticated, anon, public;
