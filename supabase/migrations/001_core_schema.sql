-- =============================================================================
-- VelocityStudy — 001_core_schema
--
-- Core tables, indexes, integrity triggers and Row Level Security.
--
-- Security model
--   * Every table has RLS enabled. The `anon` role has NO table access; all
--     users (including one-click research participants, who use Supabase
--     anonymous sign-in) are `authenticated` and own rows via auth.uid().
--   * Profile progression (xp, level, streaks, unlocks, role) is NOT writable
--     by clients. Only display_name and selected_avatar are client-updatable.
--     Progression must be written by trusted server code (service role) or a
--     future SECURITY DEFINER RPC.
--   * question_attempts are an append-only trial log: insert-only for the
--     session owner, `is_correct` is computed server-side by trigger.
--   * Researchers (profiles.role = 'researcher') can read all study data.
--     The researcher role can only be granted out-of-band (SQL / service role).
--
-- Research-data retention
--   Foreign keys from study data to users/decks use SET NULL / RESTRICT so
--   that deleting an account or deck never silently destroys trial data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enum types
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('student', 'researcher');
create type public.question_difficulty as enum ('easy', 'medium', 'hard');
create type public.scoring_mode as enum (
  'control',
  'linear_speed',
  'exponential_streak',
  'variable_pressure'
);
create type public.session_type as enum (
  'solo',
  'multiplayer',
  'experiment',
  'retention_retest'
);

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  display_name         text not null
                         check (char_length(btrim(display_name)) between 1 and 40),
  role                 public.user_role not null default 'student',
  xp                   integer not null default 0 check (xp >= 0),
  level                integer not null default 1 check (level >= 1),
  selected_avatar      text not null default 'default',
  unlocked_avatars     jsonb not null default '["default"]'::jsonb,
  current_streak_days  integer not null default 0 check (current_streak_days >= 0),
  -- Anonymized research ID (e.g. 'P-7492'). Set for anonymous participants.
  participant_code     text unique
                         check (participant_code ~ '^P-[0-9]{4,8}$'),
  created_at           timestamptz not null default now(),

  constraint profiles_unlocked_avatars_is_array
    check (jsonb_typeof(unlocked_avatars) = 'array'),
  constraint profiles_selected_avatar_unlocked
    check (unlocked_avatars ? selected_avatar)
);

comment on column public.profiles.participant_code is
  'Anonymized research participant ID (P-####). Assigned by handle_new_user().';

-- -----------------------------------------------------------------------------
-- decks
-- -----------------------------------------------------------------------------
create table public.decks (
  id            uuid primary key default gen_random_uuid(),
  -- Nullable + SET NULL so benchmark decks referenced by experiments survive
  -- account deletion.
  owner_id      uuid references public.profiles (id) on delete set null,
  title         text not null check (char_length(btrim(title)) between 1 and 120),
  subject       text not null check (char_length(btrim(subject)) between 1 and 60),
  description   text not null default '' check (char_length(description) <= 1000),
  is_public     boolean not null default false,
  is_benchmark  boolean not null default false,
  created_at    timestamptz not null default now()
);

create index decks_owner_id_idx on public.decks (owner_id);
create index decks_public_created_idx on public.decks (created_at desc) where is_public;
create index decks_benchmark_idx on public.decks (id) where is_benchmark;

-- -----------------------------------------------------------------------------
-- questions
-- -----------------------------------------------------------------------------
create table public.questions (
  id             uuid primary key default gen_random_uuid(),
  deck_id        uuid not null references public.decks (id) on delete cascade,
  prompt         text not null check (char_length(btrim(prompt)) between 1 and 1000),
  options        jsonb not null,
  correct_index  smallint not null check (correct_index between 0 and 3),
  difficulty     public.question_difficulty not null default 'medium',
  explanation    text not null default '' check (char_length(explanation) <= 2000),
  tags           text[] not null default '{}',
  order_index    integer not null check (order_index >= 0),

  -- Exactly four string options.
  constraint questions_options_four_strings check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) = 4
    and jsonb_typeof(options -> 0) = 'string'
    and jsonb_typeof(options -> 1) = 'string'
    and jsonb_typeof(options -> 2) = 'string'
    and jsonb_typeof(options -> 3) = 'string'
  ),
  -- Deferrable so a deck can be reordered inside one transaction.
  constraint questions_deck_order_unique
    unique (deck_id, order_index) deferrable initially deferred
);

create index questions_tags_gin_idx on public.questions using gin (tags);

-- -----------------------------------------------------------------------------
-- experiments
-- -----------------------------------------------------------------------------
create table public.experiments (
  id                       uuid primary key default gen_random_uuid(),
  creator_id               uuid references public.profiles (id) on delete set null,
  title                    text not null check (char_length(btrim(title)) between 1 and 120),
  deck_id                  uuid not null references public.decks (id) on delete restrict,
  -- Latin-square counterbalancing: array of rows, each row an ordered array of
  -- scoring_mode values, e.g. [["control","linear_speed"],["linear_speed","control"]].
  -- Structural validation (square, each mode once per row/column) lives in
  -- src/lib so it can be unit-tested; the DB enforces the outer shape.
  condition_order_matrix   jsonb not null,
  enable_confidence_probe  boolean not null default false,
  enable_retention_retest  boolean not null default false,
  is_active                boolean not null default false,
  created_at               timestamptz not null default now(),

  constraint experiments_matrix_non_empty_array check (
    jsonb_typeof(condition_order_matrix) = 'array'
    and jsonb_array_length(condition_order_matrix) > 0
  )
);

create index experiments_creator_id_idx on public.experiments (creator_id);
create index experiments_deck_id_idx on public.experiments (deck_id);
create index experiments_active_idx on public.experiments (id) where is_active;

-- -----------------------------------------------------------------------------
-- study_sessions
-- -----------------------------------------------------------------------------
create table public.study_sessions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references public.profiles (id) on delete set null,
  participant_code          text check (participant_code ~ '^P-[0-9]{4,8}$'),
  experiment_id             uuid references public.experiments (id) on delete restrict,
  deck_id                   uuid not null references public.decks (id) on delete restrict,
  scoring_mode              public.scoring_mode not null,
  session_type              public.session_type not null,
  powerups_enabled          boolean not null default false,
  total_score               integer not null default 0,
  accuracy_pct              numeric(5, 2) check (accuracy_pct between 0 and 100),
  avg_rt_ms                 integer check (avg_rt_ms >= 0),
  -- IES = mean correct RT / proportion correct. NULL when no correct answers.
  inverse_efficiency_score  numeric(12, 2) check (inverse_efficiency_score >= 0),
  started_at                timestamptz not null default now(),
  completed_at              timestamptz,

  constraint study_sessions_completed_after_start
    check (completed_at is null or completed_at >= started_at),
  constraint study_sessions_experiment_required
    check (session_type <> 'experiment' or experiment_id is not null)
);

create index study_sessions_user_started_idx
  on public.study_sessions (user_id, started_at desc);
create index study_sessions_experiment_id_idx
  on public.study_sessions (experiment_id) where experiment_id is not null;
create index study_sessions_deck_id_idx on public.study_sessions (deck_id);
create index study_sessions_participant_code_idx
  on public.study_sessions (participant_code) where participant_code is not null;

-- -----------------------------------------------------------------------------
-- question_attempts (append-only trial log)
-- -----------------------------------------------------------------------------
create table public.question_attempts (
  id                     uuid primary key default gen_random_uuid(),
  session_id             uuid not null references public.study_sessions (id) on delete cascade,
  question_id            uuid not null references public.questions (id) on delete restrict,
  -- Regime actually applied on this trial (may differ from the session's
  -- scoring_mode under variable_pressure).
  applied_regime         public.scoring_mode not null,
  time_limit_ms          integer check (time_limit_ms > 0),
  reaction_time_ms       integer not null check (reaction_time_ms >= 0),
  first_hover_ms         integer check (first_hover_ms >= 0),
  option_hover_switches  integer not null default 0 check (option_hover_switches >= 0),
  selected_index         smallint check (selected_index between 0 and 3),
  -- Overwritten by trigger from questions.correct_index; never trust the client.
  is_correct             boolean not null default false,
  timed_out              boolean not null default false,
  confidence_rating      smallint check (confidence_rating between 1 and 3),
  powerup_used           text check (char_length(powerup_used) between 1 and 40),
  points_awarded         integer not null default 0,
  streak_before          integer not null default 0 check (streak_before >= 0),
  tab_switched           boolean not null default false,
  created_at             timestamptz not null default now(),

  constraint question_attempts_timeout_has_no_answer
    check (not timed_out or selected_index is null),
  -- One attempt per question per session (guards against double submits).
  constraint question_attempts_session_question_unique
    unique (session_id, question_id)
);

create index question_attempts_question_id_idx on public.question_attempts (question_id);

-- =============================================================================
-- Helper functions (SECURITY DEFINER, empty search_path, fully-qualified names)
-- These bypass RLS internally so policies can use them without recursion.
-- =============================================================================

create function public.is_researcher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'researcher'
  );
$$;

create function public.current_participant_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.participant_code from public.profiles p where p.id = (select auth.uid());
$$;

create function public.can_read_deck(p_deck_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.decks d
    where d.id = p_deck_id
      and (
        d.is_public
        or d.owner_id = (select auth.uid())
        or public.is_researcher()
        or exists (
          select 1 from public.experiments e
          where e.deck_id = d.id and e.is_active
        )
      )
  );
$$;

create function public.can_write_deck(p_deck_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.decks d
    where d.id = p_deck_id
      and (
        d.owner_id = (select auth.uid())
        or (d.is_benchmark and public.is_researcher())
      )
  );
$$;

create function public.owns_open_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.study_sessions s
    where s.id = p_session_id
      and s.user_id = (select auth.uid())
      and s.completed_at is null
  );
$$;

create function public.owns_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.study_sessions s
    where s.id = p_session_id and s.user_id = (select auth.uid())
  );
$$;

-- Generates a unique P-#### code; widens to more digits if the 4-digit space
-- is crowded so assignment never loops indefinitely.
create function public.generate_participant_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  candidate text;
  digits    integer := 4;
  attempts  integer := 0;
begin
  loop
    candidate := 'P-' || lpad(
      (floor(random() * (10 ^ digits - 10 ^ (digits - 1))) + 10 ^ (digits - 1))::bigint::text,
      digits,
      '0'
    );
    exit when not exists (
      select 1 from public.profiles p where p.participant_code = candidate
    );
    attempts := attempts + 1;
    if attempts % 25 = 0 and digits < 8 then
      digits := digits + 1;
    end if;
  end loop;
  return candidate;
end;
$$;

revoke execute on function public.generate_participant_code() from public, anon, authenticated;

-- =============================================================================
-- Triggers
-- =============================================================================

-- Create a profile for every new auth user. Role is ALWAYS 'student' here;
-- client-supplied metadata is never trusted for role.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested_code text := new.raw_user_meta_data ->> 'participant_code';
  v_code           text;
  v_name           text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  if new.is_anonymous then
    -- Honour a previously-issued code stored on the device if it is still free,
    -- so a returning participant keeps the same research ID.
    if v_requested_code ~ '^P-[0-9]{4,8}$'
       and not exists (select 1 from public.profiles p where p.participant_code = v_requested_code)
    then
      v_code := v_requested_code;
    else
      v_code := public.generate_participant_code();
    end if;
    v_name := v_code;
  end if;

  if char_length(v_name) = 0 then
    v_name := split_part(coalesce(new.email, ''), '@', 1);
  end if;
  if char_length(v_name) = 0 then
    v_name := 'Player';
  end if;

  insert into public.profiles (id, display_name, participant_code)
  values (new.id, left(v_name, 40), v_code);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Grade attempts server-side and verify the question belongs to the session's
-- deck. Clients cannot forge is_correct.
create function public.grade_question_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  q_correct  smallint;
  q_deck     uuid;
  s_deck     uuid;
begin
  select q.correct_index, q.deck_id into q_correct, q_deck
  from public.questions q where q.id = new.question_id;

  select s.deck_id into s_deck
  from public.study_sessions s where s.id = new.session_id;

  if q_deck is null or s_deck is null or q_deck <> s_deck then
    raise exception 'question % does not belong to the deck of session %',
      new.question_id, new.session_id
      using errcode = 'check_violation';
  end if;

  new.is_correct := (not new.timed_out)
                    and new.selected_index is not null
                    and new.selected_index = q_correct;
  return new;
end;
$$;

create trigger question_attempts_grade
  before insert on public.question_attempts
  for each row execute function public.grade_question_attempt();

-- =============================================================================
-- Privileges (defence in depth on top of RLS)
-- =============================================================================

revoke all on public.profiles, public.decks, public.questions, public.experiments,
              public.study_sessions, public.question_attempts
  from anon;

-- Profiles: clients may only edit cosmetic, non-progression columns.
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, selected_avatar) on public.profiles to authenticated;

-- Trial log is immutable from the client.
revoke update, delete on public.question_attempts from authenticated;

-- Sessions are never deleted by clients, and only result columns may change
-- after creation (identity, deck, experiment and regime are fixed at insert).
revoke update, delete on public.study_sessions from authenticated;
grant update (total_score, accuracy_pct, avg_rt_ms, inverse_efficiency_score, completed_at)
  on public.study_sessions to authenticated;

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.profiles          enable row level security;
alter table public.decks             enable row level security;
alter table public.questions         enable row level security;
alter table public.experiments       enable row level security;
alter table public.study_sessions    enable row level security;
alter table public.question_attempts enable row level security;

-- ---- profiles ---------------------------------------------------------------
create policy "profiles: read own or researcher"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_researcher());

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---- decks ------------------------------------------------------------------
create policy "decks: read accessible"
  on public.decks for select to authenticated
  using (public.can_read_deck(id));

create policy "decks: insert own"
  on public.decks for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (not is_benchmark or public.is_researcher())
  );

create policy "decks: update own"
  on public.decks for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (not is_benchmark or public.is_researcher())
  );

create policy "decks: delete own non-benchmark"
  on public.decks for delete to authenticated
  using (owner_id = (select auth.uid()) and not is_benchmark);

-- ---- questions --------------------------------------------------------------
create policy "questions: read if deck readable"
  on public.questions for select to authenticated
  using (public.can_read_deck(deck_id));

create policy "questions: insert if deck writable"
  on public.questions for insert to authenticated
  with check (public.can_write_deck(deck_id));

create policy "questions: update if deck writable"
  on public.questions for update to authenticated
  using (public.can_write_deck(deck_id))
  with check (public.can_write_deck(deck_id));

create policy "questions: delete if deck writable"
  on public.questions for delete to authenticated
  using (public.can_write_deck(deck_id));

-- ---- experiments ------------------------------------------------------------
create policy "experiments: read active or researcher"
  on public.experiments for select to authenticated
  using (is_active or public.is_researcher());

create policy "experiments: researcher insert own"
  on public.experiments for insert to authenticated
  with check (public.is_researcher() and creator_id = (select auth.uid()));

create policy "experiments: researcher update own"
  on public.experiments for update to authenticated
  using (public.is_researcher() and creator_id = (select auth.uid()))
  with check (public.is_researcher() and creator_id = (select auth.uid()));

create policy "experiments: researcher delete own"
  on public.experiments for delete to authenticated
  using (public.is_researcher() and creator_id = (select auth.uid()));

-- ---- study_sessions ---------------------------------------------------------
create policy "study_sessions: read own or researcher"
  on public.study_sessions for select to authenticated
  using (user_id = (select auth.uid()) or public.is_researcher());

create policy "study_sessions: insert own"
  on public.study_sessions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and completed_at is null
    and public.can_read_deck(deck_id)
    and (participant_code is null or participant_code = public.current_participant_code())
    and (
      experiment_id is null
      or exists (
        select 1 from public.experiments e
        where e.id = study_sessions.experiment_id
          and e.is_active
          and e.deck_id = study_sessions.deck_id
      )
    )
  );

-- Owners may update a session only while it is open; once completed_at is
-- set the row is frozen.
create policy "study_sessions: update own open"
  on public.study_sessions for update to authenticated
  using (user_id = (select auth.uid()) and completed_at is null)
  with check (user_id = (select auth.uid()));

-- ---- question_attempts ------------------------------------------------------
create policy "question_attempts: read own or researcher"
  on public.question_attempts for select to authenticated
  using (public.owns_session(session_id) or public.is_researcher());

create policy "question_attempts: insert into own open session"
  on public.question_attempts for insert to authenticated
  with check (public.owns_open_session(session_id));