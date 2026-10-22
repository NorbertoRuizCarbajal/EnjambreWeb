-- Enjambre · CRM y mapa interno. Ejecutar completo en Supabase → SQL Editor (es idempotente en lo posible).
-- Principio: los visitantes NO tienen acceso directo a ninguna tabla. Solo la función de servidor
-- (con la Secret key) llama a create_contact_submission(). El equipo accede con sesión + staff_members.

-- ===== Equipo (roles en tabla propia, NO en metadatos editables por el usuario) =====
create table if not exists public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','seguimiento')),
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.staff_members where user_id = auth.uid()) $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.staff_members where user_id = auth.uid() and role = 'admin') $$;

-- ===== Contactos =====
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  organization text,
  email text not null,
  phone text,
  interest_type text,
  message text,
  status text not null default 'nuevo' check (status in
    ('nuevo','contactado','en_seguimiento','reunion_programada','propuesta_enviada',
     'contrato_concretado','cerrado_sin_conversion','archivado')),
  assignee_id uuid references public.staff_members(user_id) on delete set null, -- sin responsable inicial
  next_follow_up_at timestamptz,
  source text not null default 'landing'
);
create index if not exists contacts_status_idx on public.contacts(status, created_at desc);

create table if not exists public.contact_interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  author_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('formulario','nota','llamada','correo','reunion','cambio_de_estado')),
  note text,
  status_before text,
  status_after text
);
create index if not exists interactions_contact_idx on public.contact_interactions(contact_id, created_at);

create table if not exists public.waterbody_locations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  waterbody_name text,
  locality text,
  municipality text,
  state text,
  country text not null default 'México',
  latitude double precision,
  longitude double precision,
  precision text not null default 'aproximada' check (precision in ('aproximada','exacta')),
  consent_to_use_location boolean not null default false,
  created_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between 14 and 33 and longitude between -119 and -86)),
  check (latitude is null or consent_to_use_location)   -- sin consentimiento no se guardan coordenadas
);
create index if not exists locations_contact_idx on public.waterbody_locations(contact_id);

-- Evaluación del sitio (separada del estado comercial)
create table if not exists public.waterbody_assessments (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.waterbody_locations(id) on delete cascade,
  status text not null default 'sin_evaluar' check (status in
    ('sin_evaluar','en_revision','viable_preliminar','no_viable','viable_confirmada')),
  notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz not null default now()
);
create index if not exists assessments_loc_idx on public.waterbody_assessments(location_id, reviewed_at desc);

-- Intentos de envío (antiabuso por IP con hash; sin IP en claro)
create table if not exists public.submission_attempts (
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists attempts_idx on public.submission_attempts(ip_hash, created_at);

-- ===== Función de alta (solo service role) =====
create or replace function public.create_contact_submission(p jsonb, p_ip_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; lid uuid; has_pin boolean := (p->>'lat') is not null and (p->>'lng') is not null;
begin
  delete from submission_attempts where created_at < now() - interval '1 day';
  if (select count(*) from submission_attempts where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into submission_attempts(ip_hash) values (p_ip_hash);

  insert into contacts(full_name, organization, email, phone, interest_type, message)
  values (p->>'nombre', nullif(p->>'organizacion',''), p->>'correo', nullif(p->>'telefono',''),
          nullif(p->>'interes',''), nullif(p->>'mensaje',''))
  returning id into cid;

  insert into contact_interactions(contact_id, type, note) values (cid, 'formulario', nullif(p->>'mensaje',''));

  if has_pin or coalesce(p->>'cuerpo_agua','') <> '' or coalesce(p->>'municipio','') <> '' or coalesce(p->>'estado','') <> '' then
    insert into waterbody_locations(contact_id, waterbody_name, municipality, state, country, latitude, longitude,
                                    precision, consent_to_use_location)
    values (cid, nullif(p->>'cuerpo_agua',''), nullif(p->>'municipio',''), nullif(p->>'estado',''), 'México',
            case when has_pin then (p->>'lat')::double precision end,
            case when has_pin then (p->>'lng')::double precision end,
            'aproximada', has_pin and coalesce((p->>'consentimiento_ubicacion')::boolean, false))
    returning id into lid;
    insert into waterbody_assessments(location_id) values (lid);
  end if;
  return cid;
end $$;
revoke all on function public.create_contact_submission(jsonb, text) from public, anon, authenticated;
grant execute on function public.create_contact_submission(jsonb, text) to service_role;

-- ===== Historial automático de cambios de estado =====
create or replace function public.log_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into contact_interactions(contact_id, author_id, type, status_before, status_after)
    values (new.id, auth.uid(), 'cambio_de_estado', old.status, new.status);
  end if;
  return new;
end $$;
drop trigger if exists contacts_status_log on public.contacts;
create trigger contacts_status_log after update of status on public.contacts
for each row execute function public.log_status_change();

-- ===== Resumen para el panel (respeta RLS: solo equipo) =====
create or replace function public.staff_summary() returns json
language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'nuevos', count(*) filter (where status = 'nuevo'),
    'seguimientos_vencidos', count(*) filter (where next_follow_up_at < now()
        and status not in ('contrato_concretado','cerrado_sin_conversion','archivado')),
    'propuestas_enviadas', count(*) filter (where status = 'propuesta_enviada'),
    'contratos_concretados', count(*) filter (where status = 'contrato_concretado'),
    'cerrados', count(*) filter (where status = 'cerrado_sin_conversion'))
  from contacts $$;
revoke all on function public.staff_summary() from public, anon;
grant execute on function public.staff_summary() to authenticated;

-- ===== Seguridad: RLS en todo + privilegios mínimos =====
alter table public.staff_members enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_interactions enable row level security;
alter table public.waterbody_locations enable row level security;
alter table public.waterbody_assessments enable row level security;
alter table public.submission_attempts enable row level security;   -- sin políticas: nadie con clave publicable accede

revoke all on public.staff_members, public.contacts, public.contact_interactions, public.waterbody_locations,
  public.waterbody_assessments, public.submission_attempts from anon, authenticated;
grant select on public.staff_members, public.contacts, public.contact_interactions,
  public.waterbody_locations, public.waterbody_assessments to authenticated;
grant update (status, assignee_id, next_follow_up_at) on public.contacts to authenticated;
grant insert (contact_id, author_id, type, note) on public.contact_interactions to authenticated;
grant insert (location_id, status, notes, reviewed_by) on public.waterbody_assessments to authenticated;
grant insert, update, delete on public.staff_members to authenticated;  -- filtrado por políticas (solo admin)

drop policy if exists staff_select on public.staff_members;
create policy staff_select on public.staff_members for select to authenticated using (public.is_staff());
drop policy if exists staff_admin_write on public.staff_members;
create policy staff_admin_write on public.staff_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts for select to authenticated using (public.is_staff());
drop policy if exists contacts_update on public.contacts;
create policy contacts_update on public.contacts for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists interactions_select on public.contact_interactions;
create policy interactions_select on public.contact_interactions for select to authenticated using (public.is_staff());
drop policy if exists interactions_insert on public.contact_interactions;
create policy interactions_insert on public.contact_interactions for insert to authenticated
  with check (public.is_staff() and author_id = auth.uid() and type in ('nota','llamada','correo','reunion'));

drop policy if exists locations_select on public.waterbody_locations;
create policy locations_select on public.waterbody_locations for select to authenticated using (public.is_staff());

drop policy if exists assessments_select on public.waterbody_assessments;
create policy assessments_select on public.waterbody_assessments for select to authenticated using (public.is_staff());
drop policy if exists assessments_insert on public.waterbody_assessments;
create policy assessments_insert on public.waterbody_assessments for insert to authenticated
  with check (public.is_staff() and reviewed_by = auth.uid());

-- No hay políticas de DELETE en contactos/historial/ubicaciones: el historial no se borra (usar estado 'archivado').
-- Primer administrador: ver DEPLOY.md (se crea el usuario en Auth y se inserta su fila en staff_members).
