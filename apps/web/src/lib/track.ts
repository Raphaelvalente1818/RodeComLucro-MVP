// apps/web/src/lib/track.ts
//
// SDK fino de instrumentação — grava em public.analytics_event, a base do
// futuro painel admin (Docs/PRD-tecnico-admin.html). Diferente das gravações
// de negócio (lib/frete.ts, lib/motorista.ts), analytics NÃO passa pela fila
// offline (lib/filaOffline.ts): perder um evento ocasional por falta de sinal
// é aceitável, perder uma análise salva não é. Por isso track() é
// "fire-and-forget" — chame sem await, nunca trava a navegação/UI, e falha
// em silêncio (só console.error) se der erro.
//
// event_name segue o catálogo do PRD-tecnico-admin.html (seção 11):
// signup_completed, truck_profile_saved, freight_search, simulation_run,
// freight_accepted, opportunity_engaged. (expense_logged do PRD não se aplica
// ainda — não existe funcionalidade de lançamento de gasto avulso no app.)

import { supabase } from './supabaseClient';

export type EventName =
  | 'signup_completed'
  | 'truck_profile_saved'
  | 'freight_search'
  | 'simulation_run'
  | 'freight_accepted'
  | 'opportunity_engaged';

/**
 * Grava um evento de analytics. Fire-and-forget: chame como `void track(...)`,
 * nunca `await` bloqueando a UI. actor_id vem da sessão atual (auth.uid()) —
 * se não houver sessão (não deveria acontecer, todo evento hoje é
 * pós-login), o insert falha pela RLS e só loga o erro, sem quebrar nada.
 */
export async function track(eventName: EventName, props: Record<string, unknown> = {}): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const actorId = data.session?.user.id ?? null;
    if (!actorId) return; // sem sessão, não há em nome de quem gravar (RLS exigiria actor_id = auth.uid()).
    const { error } = await supabase.from('analytics_event').insert({
      event_name: eventName,
      actor_id: actorId,
      source: 'app',
      props,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[track] falha ao gravar evento', eventName, error);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[track] excecao ao gravar evento', eventName, e);
  }
}
