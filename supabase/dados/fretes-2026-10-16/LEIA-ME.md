# Base de fretes de 16/10/2026 (planilha fretes16outubro.xlsx)

13.145 anúncios da Fretebras (12–16/10), 2.402 empresas. Depois de descartar 42 linhas
inválidas e deduplicar pela chave Empresa+Origem+Destino+Carga+Valor (fica o mais recente):
**11.779 fretes** e **2.387 empresas**. Gerado pelo Claude a partir da planilha (script no
chat de 16/10); a base antiga (809 de agosto) foi apagada pela migration
`20261016120000_fretes_fonte_fretebras_e_empresas_fretebras.sql`.

Rodar na raiz do repo, nesta ordem (CLI já logada; cada arquivo ~600 fretes):

```
for %f in (supabase\dados\fretes-2026-10-16\fretes_*.sql) do npx supabase@latest db query --project-ref gastwloozlzthpqhxnzr -f %f
```

```
npx supabase@latest db query --project-ref gastwloozlzthpqhxnzr -f supabase\dados\fretes-2026-10-16\empresas.sql
```

```
npx supabase@latest db query --project-ref gastwloozlzthpqhxnzr -f supabase\dados\fretes-2026-10-16\99_geolocalizar_e_conferir.sql
```

Os INSERTs têm `on conflict (fonte_url) do nothing` — rodar duas vezes não duplica.
