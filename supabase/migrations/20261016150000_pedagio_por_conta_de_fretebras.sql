-- Passo 8 do roteiro (16/10/2026): pedágio pago pelo embarcador.
-- Na base Fretebras o anunciante escreve isso nas observações ("FRETE + PEDÁGIO NO TAG",
-- "vale-pedágio", "pedágio por conta da empresa"). Marca pedagio_por_conta_de = 'empresa'
-- nesses casos; "pedágio incluso no valor" NÃO conta (aí o motorista paga do frete).
-- O robô de fretes deve aplicar a mesma regra ao inserir.

update public.fretes_publicados
set pedagio_por_conta_de = 'empresa'
where fonte = 'FRETEBRAS'
  and pedagio_por_conta_de is null
  and observacoes ~* '(\+ *ped[aá]gio|mais ped[aá]gio|ped[aá]gio[s]? (no|na|via|pelo|pela) tag|ped[aá]gio[s]? pago|pagamos o ped|por conta d[ao] (empresa|embarcador|contratante)|vale[- ]?ped|ped[aá]gio[s]? (a|à) parte|ped[aá]gio[s]? separado)';
