-- Executar no SQL Editor do Supabase (projeto kduhyroeubmzkxffavhb)
-- Permite leitura anónima das frações para o ecrã de registo

-- Utilizadores não autenticados podem ver as frações (só fraction, description, sort_order)
-- Necessário para o dropdown de registo funcionar sem login
create policy "fractions: leitura pública para registo"
  on public.quota_fractions for select
  to anon
  using (true);
