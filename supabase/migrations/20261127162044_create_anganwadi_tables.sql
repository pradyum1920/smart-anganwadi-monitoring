-- The Express API connects to Postgres with the private SUPABASE_DB_URL.
-- Keep these document tables inaccessible through the public Supabase API.
create table if not exists public.users (
  id text primary key default gen_random_uuid()::text,
  document jsonb not null check (jsonb_typeof(document) = 'object')
);
create table if not exists public.centers (
  id text primary key default gen_random_uuid()::text,
  document jsonb not null check (jsonb_typeof(document) = 'object')
);
create table if not exists public.children (
  id text primary key default gen_random_uuid()::text,
  document jsonb not null check (jsonb_typeof(document) = 'object')
);
create table if not exists public.attendances (
  id text primary key default gen_random_uuid()::text,
  document jsonb not null check (jsonb_typeof(document) = 'object')
);
create table if not exists public.meals (
  id text primary key default gen_random_uuid()::text,
  document jsonb not null check (jsonb_typeof(document) = 'object')
);
create table if not exists public.meal_menus (
  id text primary key default gen_random_uuid()::text,
  document jsonb not null check (jsonb_typeof(document) = 'object')
);
create table if not exists public.growth_records (
  id text primary key default gen_random_uuid()::text,
  document jsonb not null check (jsonb_typeof(document) = 'object')
);
create table if not exists public.activities (
  id text primary key default gen_random_uuid()::text,
  document jsonb not null check (jsonb_typeof(document) = 'object')
);
create table if not exists public.student_participations (
  id text primary key default gen_random_uuid()::text,
  document jsonb not null check (jsonb_typeof(document) = 'object')
);
create table if not exists public.student_academic_results (
  id text primary key default gen_random_uuid()::text,
  document jsonb not null check (jsonb_typeof(document) = 'object')
);
create table if not exists public.operations (
  id text primary key default gen_random_uuid()::text,
  document jsonb not null check (jsonb_typeof(document) = 'object')
);
create table if not exists public.notices (
  id text primary key default gen_random_uuid()::text,
  document jsonb not null check (jsonb_typeof(document) = 'object')
);
create table if not exists public.calendar_events (
  id text primary key default gen_random_uuid()::text,
  document jsonb not null check (jsonb_typeof(document) = 'object')
);
create table if not exists public.funds (
  id text primary key default gen_random_uuid()::text,
  document jsonb not null check (jsonb_typeof(document) = 'object')
);
create table if not exists public.academic_progress (
  id text primary key default gen_random_uuid()::text,
  document jsonb not null check (jsonb_typeof(document) = 'object')
);

create unique index if not exists users_email_unique
  on public.users ((lower(document->>'email')));
create unique index if not exists centers_center_id_unique
  on public.centers ((document->>'centerId'));
create unique index if not exists attendances_center_date_unique
  on public.attendances ((document->>'center'), (document->>'date'));
create unique index if not exists meal_menus_valid_from_unique
  on public.meal_menus ((document->>'validFrom'));
create unique index if not exists operations_center_date_unique
  on public.operations ((document->>'center'), (document->>'date'));
create unique index if not exists academic_progress_center_year_unique
  on public.academic_progress ((document->>'center'), (document->>'year'));

create index if not exists children_center_active_idx
  on public.children ((document->>'center'), (document->>'active'));
create index if not exists attendance_center_date_idx
  on public.attendances ((document->>'center'), (document->>'date'));
create index if not exists meals_center_date_idx
  on public.meals ((document->>'center'), (document->>'date'));
create index if not exists growth_center_date_idx
  on public.growth_records ((document->>'center'), (document->>'date'));
create index if not exists activities_center_date_idx
  on public.activities ((document->>'center'), (document->>'date'));

alter table public.users enable row level security;
alter table public.centers enable row level security;
alter table public.children enable row level security;
alter table public.attendances enable row level security;
alter table public.meals enable row level security;
alter table public.meal_menus enable row level security;
alter table public.growth_records enable row level security;
alter table public.activities enable row level security;
alter table public.student_participations enable row level security;
alter table public.student_academic_results enable row level security;
alter table public.operations enable row level security;
alter table public.notices enable row level security;
alter table public.calendar_events enable row level security;
alter table public.funds enable row level security;
alter table public.academic_progress enable row level security;

revoke all on table
  public.users,
  public.centers,
  public.children,
  public.attendances,
  public.meals,
  public.meal_menus,
  public.growth_records,
  public.activities,
  public.student_participations,
  public.student_academic_results,
  public.operations,
  public.notices,
  public.calendar_events,
  public.funds,
  public.academic_progress
from anon, authenticated, service_role;
