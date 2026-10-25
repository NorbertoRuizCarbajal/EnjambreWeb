-- MIGRACIÓN 2026-10-23 · país seleccionable y pin en cualquier país.
-- Ejecutar UNA vez en Supabase → SQL Editor sobre la base que ya creaste. Es segura de repetir y no borra datos.

alter table public.contacts add column if not exists country text;
alter table public.contacts add column if not exists country_code text;
update public.contacts set country = 'México', country_code = 'MX' where country is null;   -- los contactos anteriores se registraron con país fijo México

-- Las coordenadas ya no se limitan a México: se reemplaza la restricción antigua por una global.
do $$ declare r record; begin
  for r in select conname from pg_constraint
           where conrelid = 'public.waterbody_locations'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%14%'
  loop execute format('alter table public.waterbody_locations drop constraint %I', r.conname); end loop;
end $$;
alter table public.waterbody_locations drop constraint if exists loc_coords_valid;
alter table public.waterbody_locations add constraint loc_coords_valid
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180));

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
