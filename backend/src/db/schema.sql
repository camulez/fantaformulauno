-- FantaFormula1 — schema Supabase (Postgres). Idempotente: eseguire nell'SQL editor di Supabase.

create extension if not exists "pgcrypto";

-- ============ Identità persistente + auth ============
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  nickname text,
  pin_hash text,                       -- null = partecipante solo-storico (non fa login)
  created_at timestamptz not null default now()
);

-- ============ Stagioni ============
do $$ begin
  create type season_mode as enum ('summary','live');
exception when duplicate_object then null; end $$;

create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  year int not null unique,
  mode season_mode not null default 'live',
  status text not null default 'setup',   -- setup|auction|running|closed
  total_rounds int not null default 24,   -- lunghezza calendario, impostabile in fase d'asta
  created_at timestamptz not null default now()
);

-- additivo per DB già esistenti
alter table seasons add column if not exists total_rounds int not null default 24;

-- ============ Squadre fantasy (per stagione) ============
create table if not exists fantasy_teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  person_id uuid not null references people(id),
  name text not null,
  tm_nickname text,
  budget_initial int not null default 1835,
  created_at timestamptz not null default now(),
  unique(season_id, person_id)
);

-- ============ Storico (riepilogo per stagione) ============
create table if not exists season_entries (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id),
  season_id uuid not null references seasons(id) on delete cascade,
  team_name text,
  is_champion boolean not null default false,
  is_tm_cup_winner boolean not null default false,
  final_position int,
  final_points int,
  races_won int,
  notes text,
  unique(season_id, person_id)
);

-- ============ Reference FIA (per stagione) ============
create table if not exists fia_teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  name text not null,
  engine_id uuid,
  unique(season_id, name)
);

create table if not exists engines (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  name text not null,
  factory_fia_team_id uuid,
  unique(season_id, name)
);

-- FK circolari aggiunte dopo la creazione delle due tabelle
do $$ begin
  alter table fia_teams add constraint fia_teams_engine_fk foreign key (engine_id) references engines(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table engines add constraint engines_factory_team_fk foreign key (factory_fia_team_id) references fia_teams(id);
exception when duplicate_object then null; end $$;

create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  name text not null,
  fia_team_id uuid references fia_teams(id),
  is_reserve boolean not null default false,
  unique(season_id, name)
);

-- ============ Calendario ============
create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  round_no int not null,
  name text,
  country text,
  has_sprint boolean not null default false,
  quali_at timestamptz,
  race_at timestamptz,
  code text,                           -- sigla 3 lettere location (es. JAP, CAN, MON)
  status text not null default 'scheduled',  -- scheduled|locked|scored
  unique(season_id, round_no)
);

-- additivo per DB già esistenti
alter table rounds add column if not exists code text;

-- ============ Risultati grezzi FIA (tutto il resto è derivato da qui) ============
do $$ begin
  create type fia_session as enum ('sprint','race');
exception when duplicate_object then null; end $$;
do $$ begin
  create type deduction_kind as enum ('none','partial','total');
exception when duplicate_object then null; end $$;

create table if not exists session_results (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  session fia_session not null,
  driver_id uuid not null references drivers(id),
  position int,
  fia_points int not null default 0,
  dnf boolean not null default false,
  deduction deduction_kind not null default 'none',
  unique(round_id, session, driver_id)
);

create table if not exists poles (
  round_id uuid primary key references rounds(id) on delete cascade,
  pole_driver_id uuid references drivers(id),
  note text
);

-- lineup reale per round (gestisce riserve); assente ⇒ fallback drivers.fia_team_id
create table if not exists round_lineups (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  fia_team_id uuid not null references fia_teams(id),
  driver_id uuid not null references drivers(id),
  unique(round_id, fia_team_id, driver_id)
);

-- ============ Catalogo componenti d'asta + prezzo base ============
do $$ begin
  create type asset_kind as enum ('telaio','motore','pilota','sponsor','benzina');
exception when duplicate_object then null; end $$;

create table if not exists components (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  kind asset_kind not null,
  ref_driver_id uuid references drivers(id),
  ref_fia_team_id uuid references fia_teams(id),
  ref_engine_id uuid references engines(id),
  name text not null,
  base_price int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_components_season on components(season_id);

-- ============ Roster datato (cuore del mercato/cambi) ============
do $$ begin
  create type roster_slot as enum ('telaio','motore','pilota1','pilota2','sponsor','benzina');
exception when duplicate_object then null; end $$;

create table if not exists roster_assignments (
  id uuid primary key default gen_random_uuid(),
  fantasy_team_id uuid not null references fantasy_teams(id) on delete cascade,
  slot roster_slot not null,
  component_id uuid not null references components(id),
  from_round int not null default 1,
  to_round int,                       -- null = ancora valido
  acquired_price int,
  source text not null default 'auction',  -- auction|market
  created_at timestamptz not null default now()
);
create index if not exists idx_roster_team_slot on roster_assignments(fantasy_team_id, slot, from_round);

-- ============ DRS ============
create table if not exists drs_declarations (
  id uuid primary key default gen_random_uuid(),
  fantasy_team_id uuid not null references fantasy_teams(id) on delete cascade,
  round_id uuid not null references rounds(id) on delete cascade,
  slot roster_slot not null,
  created_at timestamptz not null default now(),
  unique(fantasy_team_id, round_id),   -- max 1 DRS per gara
  unique(fantasy_team_id, slot)        -- uno per componente/stagione
);

-- ============ Mercato (ledger economico) ============
create table if not exists market_transactions (
  id uuid primary key default gen_random_uuid(),
  fantasy_team_id uuid not null references fantasy_teams(id) on delete cascade,
  component_id uuid references components(id),
  kind text not null,                 -- buy|sell|auction
  price int not null default 0,
  effective_round int,
  created_at timestamptz not null default now()
);

-- ============ Asta persistita (stato engine come blob) ============
create table if not exists auction_sessions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  status text not null default 'idle',
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============ Config punteggi/asta per stagione (matrice a monte) ============
create table if not exists season_rules (
  season_id uuid primary key references seasons(id) on delete cascade,
  config jsonb not null default '{}'::jsonb
);

-- ============ Bacheca / chat ============
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references seasons(id) on delete cascade,
  person_id uuid not null references people(id),
  round_id uuid references rounds(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_created on messages(created_at desc);

-- ============ Simulatore: tempi sul giro ============
-- Si salva OGNI tentativo (max 3 per persona e circuito): la classifica prende il MIN,
-- ma resta traccia dei progressi. La pista prova (round_no 0) non finisce mai qui:
-- l'allenamento è libero e non si registra.
create table if not exists sim_laps (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  round_no int not null,
  person_id uuid not null references people(id),
  raw_ms int not null,                      -- cronometro puro
  penalty_ms int not null default 0,        -- limiti della pista: 3 s per infrazione
  time_ms int not null,                     -- raw + penalty: è QUESTO che fa classifica
  violations int not null default 0,
  brake_assist boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_sim_laps_class on sim_laps(season_id, round_no, time_ms);
create index if not exists idx_sim_laps_person on sim_laps(season_id, round_no, person_id);
