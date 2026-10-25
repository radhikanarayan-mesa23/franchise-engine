create table if not exists sessions (id uuid primary key, created_at timestamptz default now(), current_policy_version int not null default 1);
create table if not exists policy_versions (session_id uuid references sessions(id) on delete cascade, version int, policy jsonb not null, changed_by text, change_note text, primary key (session_id, version));
create table if not exists applications (session_id uuid references sessions(id) on delete cascade, id text, data jsonb not null, source text, updated_at timestamptz default now(), primary key (session_id, id));
create table if not exists territories (session_id uuid references sessions(id) on delete cascade, id text, data jsonb not null, primary key (session_id, id));
create table if not exists stores (session_id uuid references sessions(id) on delete cascade, id text, data jsonb not null, primary key (session_id, id));
create table if not exists ai_signals (text_hash text primary key, signals jsonb not null, model text, created_at timestamptz default now());
create table if not exists snapshots (session_id uuid references sessions(id) on delete cascade, run_no int, policy_version int, decisions jsonb not null, territories jsonb, trigger text, created_at timestamptz default now(), primary key (session_id, run_no));
create table if not exists notes (session_id uuid references sessions(id) on delete cascade, application_id text, note text, created_at timestamptz default now());
create table if not exists pipeline_events (session_id uuid references sessions(id) on delete cascade, application_id text, stage text, at date, note text);
create table if not exists review_actions (session_id uuid references sessions(id) on delete cascade, application_id text, action text, reason text, at timestamptz default now());
create table if not exists update_tokens (token text primary key, session_id uuid references sessions(id) on delete cascade, application_id text, fields_requested jsonb, expires_at timestamptz);
create table if not exists chat_messages (session_id uuid references sessions(id) on delete cascade, role text, content text, tool_calls jsonb, at timestamptz default now());
-- Server-only access with the service key; RLS on with no policies blocks anon clients.
alter table sessions enable row level security; alter table policy_versions enable row level security; alter table applications enable row level security;
alter table territories enable row level security; alter table stores enable row level security; alter table ai_signals enable row level security;
alter table snapshots enable row level security; alter table notes enable row level security; alter table pipeline_events enable row level security;
alter table review_actions enable row level security; alter table update_tokens enable row level security; alter table chat_messages enable row level security;
