-- MIGRACIÓN 2026-11-13 · permisos por rol y gestión del equipo desde el panel.
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 2026-11-11_privacidad_anonimizacion.sql. Es segura de repetir y no borra datos.
-- El mismo bloque está al final de supabase/schema.sql para bases nuevas.
--
-- Reglas:
--   · admin: ve y edita todos los contactos, reasigna responsables y gestiona el equipo.
--   · seguimiento: ve todos los contactos, pero solo edita (estado, seguimiento, notas, evaluaciones) los que tiene asignados
--     o los que aún no tienen responsable; al editar uno sin responsable, lo toma (queda asignado a sí). No puede reasignar.

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
