-- Dranbleiben: optionaler Cloud-Sync im bestehenden Sportduell-Supabase-Projekt.
-- Einmal im SQL Editor ausführen (New query → einfügen → Run). Muss NICHT ins GitHub-Repo.
-- Pro Konto eine Zeile; der komplette App-Stand liegt als JSON in "data".

create table if not exists public.dranbleiben (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.dranbleiben enable row level security;

drop policy if exists "dranbleiben lesen"   on public.dranbleiben;
drop policy if exists "dranbleiben anlegen" on public.dranbleiben;
drop policy if exists "dranbleiben ändern"  on public.dranbleiben;

-- Jeder sieht nur seine eigene Zeile.
create policy "dranbleiben lesen" on public.dranbleiben
  for select to authenticated
  using (user_id = auth.uid());

-- Anlegen nur für Konten, deren E-Mail in der Sportduell-Tabelle "players" steht
-- (verhindert, dass fremde Registrierungen Daten in dein Projekt schreiben).
create policy "dranbleiben anlegen" on public.dranbleiben
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and lower(auth.jwt() ->> 'email') in (select lower(email) from public.players)
  );

create policy "dranbleiben ändern" on public.dranbleiben
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.dranbleiben to authenticated;
