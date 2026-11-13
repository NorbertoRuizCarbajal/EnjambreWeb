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
  country text,
  country_code text,
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
  constraint loc_coords_valid check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180)),
  constraint loc_consent check (latitude is null or consent_to_use_location)   -- sin consentimiento no se guardan coordenadas
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

  insert into contacts(full_name, organization, email, phone, interest_type, country, country_code, message)
  values (p->>'nombre', nullif(p->>'organizacion',''), p->>'correo', nullif(p->>'telefono',''),
          nullif(p->>'interes',''), nullif(p->>'pais',''), nullif(p->>'pais_codigo',''), nullif(p->>'mensaje',''))
  returning id into cid;

  insert into contact_interactions(contact_id, type, note) values (cid, 'formulario', nullif(p->>'mensaje',''));

  if has_pin then   -- la ubicación existe solo si la persona colocó un pin (y dio su consentimiento)
    insert into waterbody_locations(contact_id, country, latitude, longitude, precision, consent_to_use_location)
    values (cid, coalesce(nullif(p->>'pais',''), 'México'), (p->>'lat')::double precision, (p->>'lng')::double precision,
            'aproximada', coalesce((p->>'consentimiento_ubicacion')::boolean, false))
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

-- ===== Privacidad: anonimización y conservación (idéntico a migrations/2026-11-11_privacidad_anonimizacion.sql) =====
alter table public.contacts add column if not exists anonymized_at timestamptz;

-- Anonimiza UN contacto. Solo para staff con rol 'admin' (se comprueba dentro de la función).
create or replace function public.anonymize_contact(p_contact_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then        -- service_role (auth.uid() nulo) también puede llamarla
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update contacts set
    full_name = 'Datos eliminados', organization = null, email = 'eliminado+' || id || '@invalid', phone = null,
    message = null, next_follow_up_at = null, anonymized_at = coalesce(anonymized_at, now()),
    status = 'archivado'
  where id = p_contact_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  update contact_interactions set note = null where contact_id = p_contact_id;      -- las notas pueden contener datos personales
  delete from waterbody_locations where contact_id = p_contact_id;                  -- en cascada borra sus evaluaciones
end $$;
revoke all on function public.anonymize_contact(uuid) from public, anon;
grant execute on function public.anonymize_contact(uuid) to authenticated, service_role;

-- Conservación: anonimiza contactos CERRADOS (contrato_concretado, cerrado_sin_conversion, archivado) sin actividad
-- desde hace más de p_antiguedad. El plazo es una decisión del responsable y debe coincidir con el aviso de privacidad.
-- Uso manual (admin, SQL Editor):   select public.purge_inactive_contacts(interval '24 months');
-- Uso programado (opcional, requiere la extensión pg_cron):
--   select cron.schedule('enjambre-conservacion', '0 3 1 * *', $c$select public.purge_inactive_contacts(interval '24 months')$c$);
create or replace function public.purge_inactive_contacts(p_antiguedad interval)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_antiguedad < interval '30 days' then raise exception 'plazo demasiado corto' using errcode = '22023'; end if;
  for r in
    select c.id from contacts c
    where c.anonymized_at is null
      and c.status in ('contrato_concretado','cerrado_sin_conversion','archivado')
      and greatest(c.created_at, coalesce((select max(i.created_at) from contact_interactions i where i.contact_id = c.id), c.created_at))
          < now() - p_antiguedad
  loop
    perform public.anonymize_contact(r.id); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.purge_inactive_contacts(interval) from public, anon, authenticated;
grant execute on function public.purge_inactive_contacts(interval) to service_role;

-- ===== Permisos por rol y gestión del equipo (idéntico a migrations/2026-11-13_roles_y_equipo.sql) =====
-- ¿Puede la sesión actual editar este contacto?
create or replace function public.can_edit_contact(p_contact_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.is_staff() and exists (
    select 1 from contacts c where c.id = p_contact_id and (c.assignee_id is null or c.assignee_id = auth.uid())))
$$;
revoke all on function public.can_edit_contact(uuid) from public, anon;
grant execute on function public.can_edit_contact(uuid) to authenticated;

-- Contactos: seguimiento solo sobre los suyos o sin asignar, y el resultado debe quedar asignado a sí.
drop policy if exists contacts_update on public.contacts;
create policy contacts_update on public.contacts for update to authenticated
  using (public.is_admin() or (public.is_staff() and (assignee_id is null or assignee_id = auth.uid())))
  with check (public.is_admin() or (public.is_staff() and assignee_id = auth.uid()));

-- Notas y evaluaciones: mismas reglas que la edición del contacto.
drop policy if exists interactions_insert on public.contact_interactions;
create policy interactions_insert on public.contact_interactions for insert to authenticated
  with check (public.is_staff() and author_id = auth.uid() and type in ('nota','llamada','correo','reunion')
              and public.can_edit_contact(contact_id));

drop policy if exists assessments_insert on public.waterbody_assessments;
create policy assessments_insert on public.waterbody_assessments for insert to authenticated
  with check (public.is_staff() and reviewed_by = auth.uid()
              and public.can_edit_contact((select l.contact_id from public.waterbody_locations l where l.id = location_id)));

-- Equipo: admin solo puede cambiar rol y nombre visible (no el user_id); altas por correo con add_staff_by_email.
revoke update on public.staff_members from authenticated;
grant update (role, display_name) on public.staff_members to authenticated;

-- Nunca dejar el panel sin administradores (evita bloquearse por error al degradar o retirar al último admin).
create or replace function public.keep_one_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin')
     and not exists (select 1 from staff_members where role = 'admin' and user_id <> old.user_id) then
    raise exception 'last_admin: debe quedar al menos un administrador' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists staff_keep_one_admin on public.staff_members;
create trigger staff_keep_one_admin before update or delete on public.staff_members
for each row execute function public.keep_one_admin();

-- Directorio del equipo con correo (solo admin). El correo vive en auth.users, que el navegador no puede leer directamente.
create or replace function public.staff_directory()
returns table (user_id uuid, email text, role text, display_name text, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select s.user_id, u.email::text, s.role, s.display_name, s.created_at, u.last_sign_in_at
    from staff_members s join auth.users u on u.id = s.user_id
    order by s.role, s.display_name nulls last;
end $$;
revoke all on function public.staff_directory() from public, anon;
grant execute on function public.staff_directory() to authenticated;

-- Dar acceso al panel a una cuenta que YA existe en Supabase → Authentication → Users (solo admin).
create or replace function public.add_staff_by_email(p_email text, p_role text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role not in ('admin','seguimiento') then raise exception 'rol inválido' using errcode = '22023'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'user_not_found' using errcode = 'P0002'; end if;
  insert into staff_members(user_id, role, display_name) values (uid, p_role, nullif(trim(p_display_name), ''))
  on conflict (user_id) do update set role = excluded.role, display_name = coalesce(excluded.display_name, staff_members.display_name);
  return uid;
end $$;
revoke all on function public.add_staff_by_email(text, text, text) from public, anon;
grant execute on function public.add_staff_by_email(text, text, text) to authenticated;
