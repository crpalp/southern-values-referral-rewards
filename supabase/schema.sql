-- Southern Values Referral Rewards - Schema
-- Run this first.

create extension if not exists "uuid-ossp";

-- Profile table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  account_type text not null default 'customer' check (account_type in ('customer', 'partner')),
  payout_preference text default 'cash' check (payout_preference in ('cash','credit')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep profiles in sync
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, phone)
  values (new.id, new.email, new.phone)
  on conflict (id) do update set
    email = excluded.email,
    phone = excluded.phone,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Referrals
create table if not exists public.referrals (
  id uuid primary key default uuid_generate_v4(),
  referrer_user_id uuid not null references public.profiles(id) on delete cascade,
  program_type text not null default 'customer' check (program_type in ('customer','partner')),
  status text not null default 'Submitted',
  denied_reason text,
  referred_name text,
  referred_phone text,
  referred_email text,
  referred_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jobs (manual for MVP; integrates later)
create table if not exists public.jobs (
  id uuid primary key default uuid_generate_v4(),
  referral_id uuid references public.referrals(id) on delete set null,
  job_type text not null, -- Repair, Replacement, VIP_MEMBERSHIP, VIP_RENEWAL
  invoice_number text,
  invoice_total numeric(12,2) not null default 0,
  completed_date timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- Reward rules (USD for customers; points for partners)
create table if not exists public.reward_rules (
  id uuid primary key default uuid_generate_v4(),
  program_type text not null check (program_type in ('customer','partner')),
  event_type text not null, -- Repair, Replacement, VIP_MEMBERSHIP, VIP_RENEWAL
  currency_type text not null check (currency_type in ('USD_CASH','USD_CREDIT','POINTS')),
  amount numeric(12,2) not null,
  effective_from date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Defaults requested
insert into public.reward_rules (program_type, event_type, currency_type, amount, effective_from, is_active)
values
  ('customer','Repair','USD_CASH',50, current_date, true),
  ('customer','Replacement','USD_CASH',150, current_date, true),
  ('partner','Repair','POINTS',50, current_date, true),
  ('partner','Replacement','POINTS',150, current_date, true),
  ('partner','VIP_MEMBERSHIP','POINTS',25, current_date, true),
  ('partner','VIP_RENEWAL','POINTS',25, current_date, true)
on conflict do nothing;

-- Ledger entries (immutable)
create table if not exists public.ledger_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  referral_id uuid references public.referrals(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  redemption_request_id uuid,
  entry_type text not null,
  currency_type text not null check (currency_type in ('USD_CASH','USD_CREDIT','POINTS')),
  amount numeric(12,2) not null,
  memo text,
  created_by_admin_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Catalog for partner redemptions
create table if not exists public.catalog_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  points_cost integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Redemption requests
create table if not exists public.redemption_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete restrict,
  points_cost integer not null,
  status text not null default 'Requested', -- Requested, Fulfilled, Denied
  fulfillment_reference text,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now()
);

-- Admin helper views
create or replace view public.referrals_admin_view as
select
  r.*,
  coalesce(p.full_name, p.email, p.phone, r.referrer_user_id::text) as referrer_display
from public.referrals r
join public.profiles p on p.id = r.referrer_user_id;

create or replace view public.redemption_requests_admin_view as
select
  rr.*,
  ci.name as catalog_item_name,
  coalesce(p.full_name, p.email, p.phone, rr.user_id::text) as user_display
from public.redemption_requests rr
join public.catalog_items ci on ci.id = rr.catalog_item_id
join public.profiles p on p.id = rr.user_id;
