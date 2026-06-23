-- Contact upgrade requests table
create table if not exists public.contact_upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null,
  notes text,
  limit_type text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

-- RLS
alter table public.contact_upgrade_requests enable row level security;

-- Users can insert their own requests
create policy "Users can create own upgrade requests"
  on public.contact_upgrade_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can read their own requests
create policy "Users can read own upgrade requests"
  on public.contact_upgrade_requests for select
  to authenticated
  using (auth.uid() = user_id);

-- Super admins can read all requests
create policy "Super admins can read all upgrade requests"
  on public.contact_upgrade_requests for select
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );

-- Super admins can update status
create policy "Super admins can update upgrade requests"
  on public.contact_upgrade_requests for update
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );

-- Index for admin queries
create index idx_contact_upgrade_requests_status on public.contact_upgrade_requests(status);
create index idx_contact_upgrade_requests_created on public.contact_upgrade_requests(created_at desc);
