-- ============================================================
-- SEED: Primeiro tenant — condomínio pessoal de Jonas
-- Executar DEPOIS do schema principal (supabase_schema.sql)
-- ============================================================

-- 1. Inserir o condomínio
insert into public.condominiums (
  slug,
  name,
  primary_color, secondary_color, dark_color, light_color,
  app_name,
  status, plan
) values (
  'edificio-solar',            -- altera para o slug que quiseres
  'Edifício Solar',            -- nome do teu condomínio
  '#2d6a4f', '#52b788', '#1b4332', '#d8f3dc',
  'CondoApp',
  'active', 'starter'
)
on conflict (slug) do nothing
returning id;

-- 2. Depois de executar acima e obteres o UUID do condomínio,
--    usa esse UUID para inserir as frações existentes.
--
-- Exemplo (substitui <CONDO_UUID> pelo UUID retornado em cima):
--
-- insert into public.quota_fractions (condominium_id, fraction, monthly_amount, sort_order)
-- values
--   ('<CONDO_UUID>', 'A',   50.00, 1),
--   ('<CONDO_UUID>', 'B',   50.00, 2),
--   ('<CONDO_UUID>', 'C',   50.00, 3);
--
-- 3. Para promoveres o teu utilizador a admin, depois de fazeres login
--    pela primeira vez na nova app, corre:
--
-- update public.profiles
--    set role = 'admin', condominium_id = '<CONDO_UUID>'
--  where id = auth.uid();   -- ou usa o teu UUID de utilizador diretamente
