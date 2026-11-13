-- MIGRACIÓN 2026-11-11 · privacidad: eliminación de datos personales (anonimización) y conservación.
-- Ejecutar en Supabase → SQL Editor sobre la base existente. Es segura de repetir y no borra contactos que no se pidan.
-- El mismo bloque está al final de supabase/schema.sql para bases nuevas.
--
-- Por qué anonimizar en lugar de borrar la fila: el historial comercial (fechas, estados) se conserva para estadística,
-- pero desaparece todo lo que identifica a la persona: nombre, organización, correo, teléfono, mensaje, notas y ubicación.

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
