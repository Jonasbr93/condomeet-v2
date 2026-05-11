-- ============================================================
-- CONDOAPP PROD — Schema Multi-Tenant
-- Projeto: kduhyroeubmzkxffavhb (eu-west-1)
-- Executar no SQL Editor do Supabase, por esta ordem
-- ============================================================

-- ── EXTENSÕES ────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- pesquisa de texto

-- ============================================================
-- 1. TENANTS (condominiums)
--    Cada linha = um cliente / condomínio
-- ============================================================
create table public.condominiums (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),

  -- Identificação
  slug            text not null unique,           -- URL: /c/edificio-solar
  name            text not null,                  -- "Edifício Solar"
  address         text,
  tax_id          text,                           -- NIF do condomínio (para faturas)
  contact_email   text,
  contact_phone   text,

  -- Branding por cliente
  primary_color   text not null default '#2d6a4f',
  secondary_color text not null default '#52b788',
  dark_color      text not null default '#1b4332',
  light_color     text not null default '#d8f3dc',
  logo_url        text,                           -- Supabase Storage path
  app_name        text not null default 'CondoApp',

  -- Financeiro
  initial_balance numeric(10,2) not null default 0,

  -- Estado do tenant
  status          text not null default 'active'  -- active | suspended | trial
                  check (status in ('active','suspended','trial')),
  trial_ends_at   timestamptz,
  plan            text not null default 'starter' -- starter | pro | enterprise
                  check (plan in ('starter','pro','enterprise')),

  constraint slug_format check (slug ~ '^[a-z0-9-]+$')
);

-- ============================================================
-- 2. PROFILES (utilizadores)
--    Ligados ao auth.users do Supabase
-- ============================================================
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  condominium_id   uuid references public.condominiums(id) on delete set null,
  full_name        text not null default '',
  fraction         text,                          -- "3B", "1Esq", etc.
  role             text not null default 'resident'
                   check (role in ('super_admin','admin','resident')),
  -- super_admin = tu (vês todos os tenants)
  -- admin       = administrador do condomínio
  -- resident    = morador

  phone            text,
  avatar_url       text,
  notification_email boolean not null default true
);

-- Trigger: atualizar updated_at automaticamente
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Trigger: criar profile quando user se regista
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, fraction, role, condominium_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'fraction',
    coalesce(new.raw_user_meta_data->>'role', 'resident'),
    (new.raw_user_meta_data->>'condominium_id')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 3. FRAÇÕES E QUOTAS
-- ============================================================
create table public.quota_fractions (
  id               uuid primary key default uuid_generate_v4(),
  created_at       timestamptz not null default now(),
  condominium_id   uuid not null references public.condominiums(id) on delete cascade,

  fraction         text not null,                -- "A", "3B", "1Esq"
  description      text,                         -- "1º Andar Direito — T3"
  monthly_amount   numeric(10,2) not null default 0,
  sort_order       int not null default 0,

  -- Dados do proprietário (para faturas)
  owner_name       text,
  owner_tax_id     text,                         -- NIF
  owner_email      text,
  owner_address    text,

  unique (condominium_id, fraction)
);

create table public.quota_payments (
  id               uuid primary key default uuid_generate_v4(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  fraction_id      uuid not null references public.quota_fractions(id) on delete cascade,
  year             int not null,
  month            int not null check (month between 1 and 12),
  status           text not null default 'pending'
                   check (status in ('paid','pending','overdue','payment_requested')),
  note             text,
  paid_at          timestamptz,
  requested_at     timestamptz,
  paid_by          uuid references public.profiles(id) on delete set null,

  unique (fraction_id, year, month)
);

create trigger quota_payments_updated_at
  before update on public.quota_payments
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 4. CALENDÁRIO E DISPONIBILIDADES (reuniões)
-- ============================================================
create table public.calendar_dates (
  id               uuid primary key default uuid_generate_v4(),
  created_at       timestamptz not null default now(),
  condominium_id   uuid not null references public.condominiums(id) on delete cascade,
  date             date not null,
  created_by       uuid references public.profiles(id) on delete set null,

  unique (condominium_id, date)
);

create table public.availabilities (
  id                 uuid primary key default uuid_generate_v4(),
  created_at         timestamptz not null default now(),
  calendar_date_id   uuid not null references public.calendar_dates(id) on delete cascade,
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  time_slot          text not null,              -- "09:00", "14:30"
  note               text,

  unique (calendar_date_id, profile_id, time_slot)
);

-- ============================================================
-- 5. OCORRÊNCIAS
-- ============================================================
create table public.issues (
  id               uuid primary key default uuid_generate_v4(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  condominium_id   uuid not null references public.condominiums(id) on delete cascade,

  title            text not null,
  description      text,
  status           text not null default 'open'
                   check (status in ('open','in_progress','resolved')),
  created_by       uuid references public.profiles(id) on delete set null,
  resolved_at      timestamptz,
  cost             numeric(10,2),
  cost_description text
);

create trigger issues_updated_at
  before update on public.issues
  for each row execute function public.handle_updated_at();

create table public.issue_comments (
  id               uuid primary key default uuid_generate_v4(),
  created_at       timestamptz not null default now(),
  issue_id         uuid not null references public.issues(id) on delete cascade,
  profile_id       uuid references public.profiles(id) on delete set null,
  body             text not null
);

-- ============================================================
-- 6. LIMPEZAS
-- ============================================================
create table public.cleaning_dates (
  id               uuid primary key default uuid_generate_v4(),
  created_at       timestamptz not null default now(),
  condominium_id   uuid not null references public.condominiums(id) on delete cascade,
  date             date not null,
  amount           numeric(10,2) not null default 0,
  note             text,
  created_by       uuid references public.profiles(id) on delete set null
);

-- ============================================================
-- 7. UTILIDADES (água e luz)
-- ============================================================
create table public.utility_bills (
  id                    uuid primary key default uuid_generate_v4(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  condominium_id        uuid not null references public.condominiums(id) on delete cascade,
  year                  int not null,
  month                 int not null check (month between 1 and 12),
  water_amount          numeric(10,2) not null default 0,
  electricity_amount    numeric(10,2) not null default 0,
  note                  text,
  created_by            uuid references public.profiles(id) on delete set null,
  -- Guardar o ficheiro da fatura (Supabase Storage)
  water_bill_path       text,
  electricity_bill_path text,

  unique (condominium_id, year, month)
);

create trigger utility_bills_updated_at
  before update on public.utility_bills
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 8. CAIXA (movimentos financeiros)
-- ============================================================
create table public.cashbook (
  id               uuid primary key default uuid_generate_v4(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  condominium_id   uuid not null references public.condominiums(id) on delete cascade,
  type             text not null check (type in ('income','expense')),
  description      text not null,
  amount           numeric(10,2) not null check (amount > 0),
  date             date not null,
  category         text check (category in ('quotas','cleaning','water','electricity','maintenance','invoices','other')),
  created_by       uuid references public.profiles(id) on delete set null,
  -- Referência opcional a uma fatura
  invoice_id       uuid                           -- FK adicionada depois (circular ref)
);

create trigger cashbook_updated_at
  before update on public.cashbook
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 9. AGENDA / ORDEM DO DIA
-- ============================================================
create table public.agenda_topics (
  id               uuid primary key default uuid_generate_v4(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  condominium_id   uuid not null references public.condominiums(id) on delete cascade,
  title            text not null,
  description      text,
  status           text not null default 'open'
                   check (status in ('open','voting','decided')),
  conclusion       text,
  created_by       uuid references public.profiles(id) on delete set null
);

create trigger agenda_topics_updated_at
  before update on public.agenda_topics
  for each row execute function public.handle_updated_at();

create table public.agenda_votes (
  id               uuid primary key default uuid_generate_v4(),
  created_at       timestamptz not null default now(),
  topic_id         uuid not null references public.agenda_topics(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  vote             text not null check (vote in ('favor','contra','abstencao')),

  unique (topic_id, profile_id)
);

-- ============================================================
-- 10. FATURAS (base — para escalar mais tarde)
--     Uma fatura pode ser enviada a uma ou mais frações
-- ============================================================
create table public.invoices (
  id               uuid primary key default uuid_generate_v4(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  condominium_id   uuid not null references public.condominiums(id) on delete cascade,

  -- Numeração automática por tenant
  number           text not null,               -- "2024/001"
  issue_date       date not null default current_date,
  due_date         date,
  status           text not null default 'draft'
                   check (status in ('draft','sent','paid','overdue','cancelled')),

  -- Destinatário (pode ser uma fração ou externo)
  fraction_id      uuid references public.quota_fractions(id) on delete set null,
  recipient_name   text,
  recipient_tax_id text,
  recipient_email  text,
  recipient_address text,

  -- Totais (calculados a partir das linhas)
  subtotal         numeric(10,2) not null default 0,
  tax_rate         numeric(5,2) not null default 0, -- % IVA
  tax_amount       numeric(10,2) not null default 0,
  total            numeric(10,2) not null default 0,

  notes            text,
  pdf_path         text,                        -- Supabase Storage path
  sent_at          timestamptz,
  paid_at          timestamptz,
  created_by       uuid references public.profiles(id) on delete set null,

  unique (condominium_id, number)
);

create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.handle_updated_at();

create table public.invoice_lines (
  id               uuid primary key default uuid_generate_v4(),
  invoice_id       uuid not null references public.invoices(id) on delete cascade,
  sort_order       int not null default 0,
  description      text not null,
  quantity         numeric(10,3) not null default 1,
  unit_price       numeric(10,2) not null,
  amount           numeric(10,2) not null       -- quantity * unit_price
);

-- Ligar cashbook a invoices (a FK que ficou pendente)
alter table public.cashbook
  add constraint cashbook_invoice_fk
  foreign key (invoice_id) references public.invoices(id) on delete set null;

-- Sequência de número de fatura por tenant
create table public.invoice_sequences (
  condominium_id   uuid primary key references public.condominiums(id) on delete cascade,
  last_number      int not null default 0
);

-- Função para gerar número de fatura automático: "2025/001"
create or replace function public.next_invoice_number(p_condo_id uuid)
returns text language plpgsql as $$
declare
  v_year  text := to_char(current_date, 'YYYY');
  v_next  int;
begin
  insert into public.invoice_sequences (condominium_id, last_number)
  values (p_condo_id, 1)
  on conflict (condominium_id) do update
    set last_number = invoice_sequences.last_number + 1
  returning last_number into v_next;

  return v_year || '/' || lpad(v_next::text, 3, '0');
end;
$$;

-- ============================================================
-- 11. DOCUMENTOS (ficheiros gerais — atas, regulamentos, etc.)
-- ============================================================
create table public.documents (
  id               uuid primary key default uuid_generate_v4(),
  created_at       timestamptz not null default now(),
  condominium_id   uuid not null references public.condominiums(id) on delete cascade,
  name             text not null,
  description      text,
  category         text not null default 'other'
                   check (category in ('minutes','regulation','invoice','contract','other')),
  file_path        text not null,               -- Supabase Storage path
  file_size        bigint,
  mime_type        text,
  uploaded_by      uuid references public.profiles(id) on delete set null,
  -- Controlo de acesso: 'all' | 'admin'
  visibility       text not null default 'all'
                   check (visibility in ('all','admin'))
);

-- ============================================================
-- 12. ÍNDICES (performance)
-- ============================================================
create index on public.profiles (condominium_id);
create index on public.quota_fractions (condominium_id);
create index on public.quota_payments (fraction_id, year, month);
create index on public.calendar_dates (condominium_id, date);
create index on public.availabilities (calendar_date_id);
create index on public.availabilities (profile_id);
create index on public.issues (condominium_id, status);
create index on public.issues (created_at desc);
create index on public.issue_comments (issue_id);
create index on public.cleaning_dates (condominium_id, date);
create index on public.utility_bills (condominium_id, year, month);
create index on public.cashbook (condominium_id, date desc);
create index on public.agenda_topics (condominium_id, status);
create index on public.invoices (condominium_id, status);
create index on public.invoices (fraction_id);
create index on public.documents (condominium_id, category);

-- ============================================================
-- 13. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Ativar RLS em todas as tabelas
alter table public.condominiums     enable row level security;
alter table public.profiles         enable row level security;
alter table public.quota_fractions  enable row level security;
alter table public.quota_payments   enable row level security;
alter table public.calendar_dates   enable row level security;
alter table public.availabilities   enable row level security;
alter table public.issues           enable row level security;
alter table public.issue_comments   enable row level security;
alter table public.cleaning_dates   enable row level security;
alter table public.utility_bills    enable row level security;
alter table public.cashbook         enable row level security;
alter table public.agenda_topics    enable row level security;
alter table public.agenda_votes     enable row level security;
alter table public.invoices         enable row level security;
alter table public.invoice_lines    enable row level security;
alter table public.invoice_sequences enable row level security;
alter table public.documents        enable row level security;

-- ── Função helper: obter condominium_id do utilizador atual ──
create or replace function public.my_condo_id()
returns uuid language sql stable security definer as $$
  select condominium_id from public.profiles where id = auth.uid()
$$;

-- ── Função helper: role do utilizador atual ──
create or replace function public.my_role()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ── condominiums ──
-- Utilizador só vê o seu tenant
create policy "tenant: ver o próprio"
  on public.condominiums for select
  using (id = public.my_condo_id());

-- Só admin pode atualizar (nome, branding, etc.)
create policy "tenant: admin pode editar"
  on public.condominiums for update
  using (id = public.my_condo_id() and public.my_role() in ('admin','super_admin'));

-- ── profiles ──
create policy "profiles: ver do mesmo tenant"
  on public.profiles for select
  using (condominium_id = public.my_condo_id() or id = auth.uid());

create policy "profiles: editar o próprio"
  on public.profiles for update
  using (id = auth.uid());

create policy "profiles: admin pode editar qualquer um do tenant"
  on public.profiles for update
  using (condominium_id = public.my_condo_id() and public.my_role() in ('admin','super_admin'));

-- ── quota_fractions ──
create policy "fractions: ver do tenant"
  on public.quota_fractions for select
  using (condominium_id = public.my_condo_id());

create policy "fractions: admin pode gerir"
  on public.quota_fractions for all
  using (condominium_id = public.my_condo_id() and public.my_role() in ('admin','super_admin'));

-- ── quota_payments ──
create policy "payments: ver do tenant"
  on public.quota_payments for select
  using (
    fraction_id in (
      select id from public.quota_fractions where condominium_id = public.my_condo_id()
    )
  );

create policy "payments: admin pode gerir"
  on public.quota_payments for all
  using (
    fraction_id in (
      select id from public.quota_fractions where condominium_id = public.my_condo_id()
    )
    and public.my_role() in ('admin','super_admin')
  );

-- Residente pode criar/atualizar o seu próprio pedido de pagamento
create policy "payments: residente pode pedir confirmação"
  on public.quota_payments for insert
  with check (
    fraction_id in (
      select id from public.quota_fractions
      where condominium_id = public.my_condo_id()
        and fraction = (select fraction from public.profiles where id = auth.uid())
    )
  );

-- ── calendar_dates ──
create policy "calendar: ver do tenant"
  on public.calendar_dates for select
  using (condominium_id = public.my_condo_id());

create policy "calendar: admin pode criar"
  on public.calendar_dates for insert
  with check (condominium_id = public.my_condo_id() and public.my_role() in ('admin','super_admin'));

-- ── availabilities ──
create policy "avail: ver do tenant"
  on public.availabilities for select
  using (
    calendar_date_id in (
      select id from public.calendar_dates where condominium_id = public.my_condo_id()
    )
  );

create policy "avail: gerir as próprias"
  on public.availabilities for all
  using (profile_id = auth.uid());

-- ── issues ──
create policy "issues: ver do tenant"
  on public.issues for select
  using (condominium_id = public.my_condo_id());

create policy "issues: qualquer um pode criar"
  on public.issues for insert
  with check (condominium_id = public.my_condo_id());

create policy "issues: criador ou admin pode editar"
  on public.issues for update
  using (
    condominium_id = public.my_condo_id()
    and (created_by = auth.uid() or public.my_role() in ('admin','super_admin'))
  );

create policy "issues: criador ou admin pode apagar"
  on public.issues for delete
  using (
    condominium_id = public.my_condo_id()
    and (created_by = auth.uid() or public.my_role() in ('admin','super_admin'))
  );

-- ── issue_comments ──
create policy "comments: ver do tenant"
  on public.issue_comments for select
  using (
    issue_id in (select id from public.issues where condominium_id = public.my_condo_id())
  );

create policy "comments: qualquer um pode criar"
  on public.issue_comments for insert
  with check (
    issue_id in (select id from public.issues where condominium_id = public.my_condo_id())
  );

create policy "comments: criador ou admin pode apagar"
  on public.issue_comments for delete
  using (
    profile_id = auth.uid()
    or public.my_role() in ('admin','super_admin')
  );

-- ── cleaning_dates ──
create policy "cleaning: ver do tenant"
  on public.cleaning_dates for select
  using (condominium_id = public.my_condo_id());

create policy "cleaning: admin pode gerir"
  on public.cleaning_dates for all
  using (condominium_id = public.my_condo_id() and public.my_role() in ('admin','super_admin'));

-- ── utility_bills ──
create policy "utilities: ver do tenant"
  on public.utility_bills for select
  using (condominium_id = public.my_condo_id());

create policy "utilities: admin pode gerir"
  on public.utility_bills for all
  using (condominium_id = public.my_condo_id() and public.my_role() in ('admin','super_admin'));

-- ── cashbook ──
create policy "cashbook: ver do tenant"
  on public.cashbook for select
  using (condominium_id = public.my_condo_id());

create policy "cashbook: admin pode gerir"
  on public.cashbook for all
  using (condominium_id = public.my_condo_id() and public.my_role() in ('admin','super_admin'));

-- ── agenda ──
create policy "agenda topics: ver do tenant"
  on public.agenda_topics for select
  using (condominium_id = public.my_condo_id());

create policy "agenda topics: qualquer um pode criar"
  on public.agenda_topics for insert
  with check (condominium_id = public.my_condo_id());

create policy "agenda topics: criador ou admin pode gerir"
  on public.agenda_topics for update
  using (
    condominium_id = public.my_condo_id()
    and (created_by = auth.uid() or public.my_role() in ('admin','super_admin'))
  );

create policy "agenda topics: criador ou admin pode apagar"
  on public.agenda_topics for delete
  using (
    condominium_id = public.my_condo_id()
    and (created_by = auth.uid() or public.my_role() in ('admin','super_admin'))
  );

create policy "agenda votes: ver do tenant"
  on public.agenda_votes for select
  using (
    topic_id in (select id from public.agenda_topics where condominium_id = public.my_condo_id())
  );

create policy "agenda votes: gerir o próprio voto"
  on public.agenda_votes for all
  using (profile_id = auth.uid());

-- ── invoices ──
create policy "invoices: ver do tenant"
  on public.invoices for select
  using (condominium_id = public.my_condo_id());

create policy "invoices: admin pode gerir"
  on public.invoices for all
  using (condominium_id = public.my_condo_id() and public.my_role() in ('admin','super_admin'));

-- ── invoice_lines ──
create policy "invoice lines: ver do tenant"
  on public.invoice_lines for select
  using (
    invoice_id in (select id from public.invoices where condominium_id = public.my_condo_id())
  );

create policy "invoice lines: admin pode gerir"
  on public.invoice_lines for all
  using (
    invoice_id in (
      select id from public.invoices
      where condominium_id = public.my_condo_id()
        and public.my_role() in ('admin','super_admin')
    )
  );

-- ── invoice_sequences ──
create policy "invoice seq: admin pode gerir"
  on public.invoice_sequences for all
  using (condominium_id = public.my_condo_id() and public.my_role() in ('admin','super_admin'));

-- ── documents ──
create policy "documents: todos do tenant veem 'all'"
  on public.documents for select
  using (
    condominium_id = public.my_condo_id()
    and (visibility = 'all' or public.my_role() in ('admin','super_admin'))
  );

create policy "documents: admin pode gerir"
  on public.documents for all
  using (condominium_id = public.my_condo_id() and public.my_role() in ('admin','super_admin'));

-- ============================================================
-- 14. FUNÇÃO DE REGISTO — verificar fração existe no tenant
-- ============================================================
create or replace function public.check_fraction_registration(
  p_condo_id uuid,
  p_fraction  text
)
returns jsonb language plpgsql security definer as $$
declare
  v_frac   record;
  v_count  int;
begin
  -- Verificar se a fração existe
  select * into v_frac
  from public.quota_fractions
  where condominium_id = p_condo_id
    and upper(fraction) = upper(p_fraction);

  if not found then
    return jsonb_build_object('ok', false, 'error', 'fraction_not_found');
  end if;

  -- Verificar limite de utilizadores por fração (máx 2)
  select count(*) into v_count
  from public.profiles
  where condominium_id = p_condo_id
    and upper(fraction) = upper(p_fraction);

  if v_count >= 2 then
    return jsonb_build_object('ok', false, 'error', 'fraction_full');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
-- 15. STORAGE BUCKETS
-- ============================================================

-- Logos dos tenants (público — para mostrar na UI)
insert into storage.buckets (id, name, public)
values ('tenant-logos', 'tenant-logos', true)
on conflict do nothing;

-- Documentos privados (faturas, atas — acesso via signed URL)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict do nothing;

-- Faturas geradas em PDF
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict do nothing;

-- Policies de storage
create policy "logos: leitura pública"
  on storage.objects for select
  using (bucket_id = 'tenant-logos');

create policy "logos: admin do tenant pode fazer upload"
  on storage.objects for insert
  with check (
    bucket_id = 'tenant-logos'
    and public.my_role() in ('admin','super_admin')
  );

create policy "documents: só do mesmo tenant"
  on storage.objects for select
  using (
    bucket_id in ('documents','invoices')
    and (storage.foldername(name))[1] = public.my_condo_id()::text
  );

create policy "documents: admin pode fazer upload"
  on storage.objects for insert
  with check (
    bucket_id in ('documents','invoices')
    and (storage.foldername(name))[1] = public.my_condo_id()::text
    and public.my_role() in ('admin','super_admin')
  );

create policy "documents: admin pode apagar"
  on storage.objects for delete
  using (
    bucket_id in ('documents','invoices')
    and (storage.foldername(name))[1] = public.my_condo_id()::text
    and public.my_role() in ('admin','super_admin')
  );

-- ============================================================
-- FIM DO SCHEMA
-- Para inserir o primeiro tenant (o teu condomínio pessoal
-- como tenant de teste), usa o script seed_first_tenant.sql
-- ============================================================
