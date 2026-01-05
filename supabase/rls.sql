-- Southern Values Referral Rewards - Row Level Security
-- Run after schema.sql

alter table public.profiles enable row level security;
alter table public.referrals enable row level security;
alter table public.jobs enable row level security;
alter table public.reward_rules enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.catalog_items enable row level security;
alter table public.redemption_requests enable row level security;

-- Helper: is admin
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

-- PROFILES
create policy "profiles: select own" on public.profiles
for select using (auth.uid() = id or public.is_admin(auth.uid()));

create policy "profiles: update own" on public.profiles
for update using (auth.uid() = id or public.is_admin(auth.uid()))
with check (auth.uid() = id or public.is_admin(auth.uid()));

-- REFERRALS
create policy "referrals: insert own" on public.referrals
for insert with check (auth.uid() = referrer_user_id);

create policy "referrals: select own" on public.referrals
for select using (auth.uid() = referrer_user_id or public.is_admin(auth.uid()));

create policy "referrals: admin update" on public.referrals
for update using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- JOBS (admin-only for MVP)
create policy "jobs: admin all" on public.jobs
for all using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- REWARD RULES (admin-only)
create policy "reward_rules: admin read" on public.reward_rules
for select using (public.is_admin(auth.uid()));
create policy "reward_rules: admin write" on public.reward_rules
for all using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- LEDGER (users can read own, admin can write)
create policy "ledger: select own" on public.ledger_entries
for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "ledger: admin insert" on public.ledger_entries
for insert with check (public.is_admin(auth.uid()));

create policy "ledger: admin update deny" on public.ledger_entries
for update using (false);

-- CATALOG (partners read; admin write)
create policy "catalog: read all authed" on public.catalog_items
for select using (auth.role() = 'authenticated');

create policy "catalog: admin write" on public.catalog_items
for all using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- REDEMPTION REQUESTS
create policy "redemptions: insert own" on public.redemption_requests
for insert with check (auth.uid() = user_id);

create policy "redemptions: select own" on public.redemption_requests
for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "redemptions: admin update" on public.redemption_requests
for update using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
