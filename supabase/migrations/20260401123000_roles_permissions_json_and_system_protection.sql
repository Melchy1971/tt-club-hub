-- Standardisiertes Rollenmodell: JSON-Permissions + Schutz für Systemrollen

alter table public.roles
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists is_system boolean not null default false;

update public.roles
set is_system = true
where name = any(array['developer','admin','vorstand','trainer','spieler','mitglied']::public.app_role[]);

create or replace function public.prevent_system_role_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.is_system then
    raise exception 'Systemrollen dürfen nicht gelöscht werden';
  end if;

  if tg_op = 'UPDATE' and old.is_system then
    if new.name is distinct from old.name
      or new.display_name is distinct from old.display_name
      or new.description is distinct from old.description
      or new.permissions is distinct from old.permissions
      or new.is_system is distinct from old.is_system then
      raise exception 'Systemrollen dürfen nicht verändert werden';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_prevent_system_role_mutation on public.roles;
create trigger trg_prevent_system_role_mutation
before update or delete on public.roles
for each row
execute function public.prevent_system_role_mutation();
