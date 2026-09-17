-- Table unique utilisee par db.py pour les trois stores applicatifs
-- (settings, sessions, progress) -- un blob JSON par store, meme forme que
-- les fichiers data/*.json qu'elle remplace en production serverless.
--
-- A executer une fois dans l'editeur SQL du projet Supabase
-- (https://app.supabase.com/project/_/sql/new).
create table if not exists app_state (
    store text primary key,
    data jsonb not null,
    updated_at timestamptz not null default now()
);

-- Maintient updated_at a jour sur chaque upsert, sans que db.py ait besoin
-- d'y penser.
create or replace function app_state_set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists app_state_updated_at on app_state;
create trigger app_state_updated_at
    before update on app_state
    for each row
    execute function app_state_set_updated_at();

-- RLS activee par defaut sur les nouveaux projets Supabase. L'API accede a
-- cette table avec la cle service_role (qui contourne RLS), jamais avec la
-- cle anon publique -- donc aucune policy n'est necessaire ici. Ne pas
-- exposer SUPABASE_SERVICE_ROLE_KEY au frontend mobile.
alter table app_state enable row level security;
