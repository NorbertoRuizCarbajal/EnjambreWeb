/* Panel privado. Toda la seguridad real está en Supabase (RLS): este código solo usa la clave PUBLICABLE.
   Los datos de visitantes se pintan SIEMPRE con textContent (nunca innerHTML) para evitar XSS. */
(() => {
  const cfg = window.ENJAMBRE_CFG || {}, $ = (s, r = document) => r.querySelector(s);
  const ESTADOS = { nuevo: 'Nuevo', contactado: 'Contactado', en_seguimiento: 'En seguimiento', reunion_programada: 'Reunión programada', propuesta_enviada: 'Propuesta enviada', contrato_concretado: 'Contrato concretado', cerrado_sin_conversion: 'Cerrado sin conversión', archivado: 'Archivado' };
  const COLOR = { nuevo: '#e0245e', contactado: '#2f80ed', en_seguimiento: '#f2994a', reunion_programada: '#9b51e0', propuesta_enviada: '#f2c94c', contrato_concretado: '#27ae60', cerrado_sin_conversion: '#828282', archivado: '#bdbdbd' };
  const SITIO = { sin_evaluar: 'Sin evaluar', en_revision: 'En revisión', viable_preliminar: 'Viable preliminar', no_viable: 'No viable', viable_confirmada: 'Viable confirmada' };
  const ROLES = { admin: 'Administrador', seguimiento: 'Seguimiento' };
  const INTERESES = ['Inversión', 'Alianza estratégica', 'Gobierno o institución pública', 'Empresa con enfoque sostenible', 'Apoyo técnico', 'Investigación o universidad', 'Medios / prensa', 'Otro'];
  const h = (t, a, ...k) => { const e = document.createElement(t); for (const n in a || {}) { if (n === 'on') for (const ev in a.on) e.addEventListener(ev, a.on[ev]); else if (n in e && n !== 'list') e[n] = a[n]; else e.setAttribute(n, a[n]); } e.append(...k.flat().filter((x) => x != null)); return e; };
  const fmt = (d) => d ? new Date(d).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const sel = (opts, val, extra) => h('select', extra, ...Object.entries(opts).map(([v, l]) => h('option', { value: v, selected: v === val }, l)));
  let sb, staff = [], me, tab = 'resumen';
  if (!cfg.supabaseUrl || !cfg.supabaseKey) { $('#login').hidden = false; $('#le').textContent = 'Falta configurar SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en Netlify.'; return; }
  sb = supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);

  async function entrar() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { $('#app').hidden = true; $('#login').hidden = false; return; }
    const { data: yo } = await sb.from('staff_members').select('*').eq('user_id', session.user.id).maybeSingle();
    if (!yo) { await sb.auth.signOut(); $('#app').hidden = true; $('#login').hidden = false; $('#le').textContent = 'Tu cuenta no tiene acceso al panel. Pide a un administrador que te agregue.'; return; }
    me = yo; await cargarEquipo();
    $('[data-t=equipo]').hidden = me.role !== 'admin'; if (tab === 'equipo' && me.role !== 'admin') tab = 'resumen';
    $('#login').hidden = true; $('#app').hidden = false; ir(tab);
  }
  $('#lg').onclick = async () => {
    $('#le').textContent = ''; const { error } = await sb.auth.signInWithPassword({ email: $('#lm').value.trim(), password: $('#lp').value });
    if (error) { $('#le').textContent = 'Correo o contraseña incorrectos.'; return; } $('#lp').value = ''; entrar();
  };
  $('#lp').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#lg').click(); });
  $('#out').onclick = async () => { await sb.auth.signOut(); entrar(); };
  document.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => ir(b.dataset.t)));
  async function cargarEquipo() { const { data: eq } = await sb.from('staff_members').select('user_id,display_name,role'); staff = eq || []; }
  // Misma regla que la política RLS contacts_update (la base de datos es la que realmente la impone):
  // admin edita todo; seguimiento solo sus contactos o los que no tienen responsable.
  const puedeEditar = (c) => me.role === 'admin' || !c.assignee_id || c.assignee_id === me.user_id;
  const nombreStaff = (id) => { const s = staff.find((x) => x.user_id === id); return s ? (s.display_name || 'Sin nombre') : 'Sin asignar'; };

  function ir(t) {
    tab = t; document.querySelectorAll('[data-t]').forEach((b) => b.setAttribute('aria-current', b.dataset.t === t));
    const v = $('#vista'); v.replaceChildren(); ({ resumen: vResumen, contactos: vContactos, mapa: vMapa, equipo: vEquipo })[t](v);
  }

  async function vResumen(v) {
    const { data, error } = await sb.rpc('staff_summary'); if (error) { v.append(h('p', { className: 'err' }, 'No se pudo cargar el resumen.')); return; }
    const k = [['Contactos nuevos', data.nuevos], ['Seguimientos vencidos', data.seguimientos_vencidos], ['Propuestas enviadas', data.propuestas_enviadas], ['Contratos concretados', data.contratos_concretados], ['Contactos cerrados', data.cerrados]];
    v.append(h('div', { className: 'kpi' }, ...k.map(([l, n]) => h('div', { className: 'card' }, h('b', {}, String(n ?? 0)), l))));
  }

  async function vContactos(v) {
    const POR_PAGINA = 100;   // paginación en el servidor: nunca se descargan todos los contactos de una vez
    const lista = h('div', { className: 'scroll' }), cuenta = h('p', { className: 'mu' }), pag = h('div', { className: 'row', style: 'margin-top:.8rem' });
    const ctl = (l, el) => h('label', {}, l, el);
    const iq = h('input', { type: 'search', placeholder: 'Nombre, organización o correo' }), is = sel({ '': 'Todos', ...ESTADOS }, ''), ii = sel({ '': 'Todos', ...Object.fromEntries(INTERESES.map((x) => [x, x])) }, ''),
      ia = sel({ '': 'Todos', mine: 'Mis contactos', none: 'Sin asignar', ...Object.fromEntries(staff.map((s) => [s.user_id, s.display_name || 'Sin nombre'])) }, ''), id = h('input', { type: 'date' });
    let pagina = 0, turno = 0;
    async function cargar() {
      const mio = ++turno, desde = pagina * POR_PAGINA;   // `turno` descarta respuestas viejas si los filtros cambian rápido
      let q = sb.from('contacts').select('id,created_at,full_name,organization,interest_type,status,assignee_id,next_follow_up_at', { count: 'exact' })
        .order('created_at', { ascending: false }).range(desde, desde + POR_PAGINA - 1);
      if (iq.value.trim()) { const s = iq.value.trim().replace(/[,()%*\\]/g, ' '); q = q.or(`full_name.ilike.%${s}%,organization.ilike.%${s}%,email.ilike.%${s}%`); }
      if (is.value) q = q.eq('status', is.value); if (ii.value) q = q.eq('interest_type', ii.value);
      if (ia.value === 'none') q = q.is('assignee_id', null); else if (ia.value === 'mine') q = q.eq('assignee_id', me.user_id); else if (ia.value) q = q.eq('assignee_id', ia.value);
      if (id.value) q = q.gte('created_at', id.value);
      const { data, error, count } = await q; if (mio !== turno) return;
      lista.replaceChildren(); pag.replaceChildren();
      if (error) { lista.append(h('p', { className: 'err' }, 'No se pudieron cargar los contactos.')); return; }
      const total = count ?? data.length, paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
      cuenta.textContent = total + ' contacto(s)' + (total > POR_PAGINA ? ` · mostrando ${desde + 1}–${desde + data.length}` : '');
      if (paginas > 1) pag.append(
        h('button', { className: 'b', disabled: pagina === 0, on: { click: () => { pagina--; cargar(); } } }, '← Anteriores'),
        h('span', { className: 'mu' }, `Página ${pagina + 1} de ${paginas}`),
        h('button', { className: 'b', disabled: pagina >= paginas - 1, on: { click: () => { pagina++; cargar(); } } }, 'Siguientes →'));
      lista.append(h('table', {}, h('thead', {}, h('tr', {}, ...['Fecha', 'Nombre', 'Estado', 'Organización', 'Interés', 'Responsable', 'Seguimiento'].map((t) => h('th', {}, t)))),
        h('tbody', {}, ...data.map((c) => h('tr', { className: 'c', tabIndex: 0, on: { click: () => detalle(c.id), keydown: (e) => { if (e.key === 'Enter') detalle(c.id); } } },
          h('td', {}, fmt(c.created_at)), h('td', {}, c.full_name), h('td', {}, h('span', { className: 'tag' }, ESTADOS[c.status])), h('td', {}, c.organization || '—'), h('td', {}, c.interest_type || '—'), h('td', {}, nombreStaff(c.assignee_id)), h('td', {}, fmt(c.next_follow_up_at)))))));
    }
    const filtrar = () => { pagina = 0; cargar(); };
    [is, ii, ia, id].forEach((e) => e.addEventListener('change', filtrar)); iq.addEventListener('input', () => { clearTimeout(iq.t); iq.t = setTimeout(filtrar, 300); });
    v.append(h('div', { className: 'row' }, ctl('Buscar', iq), ctl('Estado', is), ctl('Interés', ii), ctl('Responsable', ia), ctl('Desde', id)), cuenta, lista, pag); cargar();
  }

  async function detalle(cid) {
    const dlg = $('#dlg'); dlg.replaceChildren(h('p', {}, 'Cargando…')); dlg.showModal();
    const [{ data: c }, { data: hist }, { data: locs }] = await Promise.all([
      sb.from('contacts').select('*').eq('id', cid).single(),
      sb.from('contact_interactions').select('*').eq('contact_id', cid).order('created_at'),
      sb.from('waterbody_locations').select('*, waterbody_assessments(status,notes,reviewed_at)').eq('contact_id', cid)]);
    if (!c) { dlg.replaceChildren(h('p', { className: 'err' }, 'No se pudo cargar el contacto.'), h('button', { className: 'b', on: { click: () => dlg.close() } }, 'Cerrar')); return; }
    const msg = h('p', { className: 'err', role: 'alert' }), esAdmin = me.role === 'admin', edita = puedeEditar(c);
    // Seguimiento no reasigna: al guardar, el contacto queda a su nombre (la política RLS exige assignee_id = quien edita).
    const ist = sel(ESTADOS, c.status), ias = esAdmin
        ? sel({ '': 'Sin asignar', ...Object.fromEntries(staff.map((s) => [s.user_id, s.display_name || 'Sin nombre'])) }, c.assignee_id || '')
        : sel(edita ? { [me.user_id]: me.display_name || 'Tú' } : { [c.assignee_id]: nombreStaff(c.assignee_id) }, edita ? me.user_id : c.assignee_id, { disabled: true }),
      ifu = h('input', { type: 'datetime-local', value: c.next_follow_up_at ? new Date(new Date(c.next_follow_up_at) - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '' });
    const guardar = h('button', { className: 'b p', on: { click: async () => {
      const { error } = await sb.from('contacts').update({ status: ist.value, assignee_id: esAdmin ? (ias.value || null) : me.user_id, next_follow_up_at: ifu.value ? new Date(ifu.value).toISOString() : null }).eq('id', cid);
      if (error) { msg.textContent = 'No se pudo guardar (puede que otra persona haya tomado este contacto).'; return; } detalle(cid); if (tab === 'contactos') ir('contactos'); } } }, 'Guardar cambios');
    const nt = h('select', {}, ...['nota', 'llamada', 'correo', 'reunion'].map((t) => h('option', { value: t }, t === 'reunion' ? 'reunión' : t))), nx = h('textarea', { rows: 3, maxLength: 2000, placeholder: 'Nota interna' });
    const addNota = h('button', { className: 'b', on: { click: async () => {
      if (!nx.value.trim()) return; const { error } = await sb.from('contact_interactions').insert({ contact_id: cid, author_id: me.user_id, type: nt.value, note: nx.value.trim() });
      if (error) { msg.textContent = 'No se pudo guardar la nota.'; return; } detalle(cid); } } }, 'Agregar a la línea de tiempo');
    // Derecho de cancelación/supresión: solo admin. Anonimiza (no borra la fila) para conservar el historial comercial sin datos personales.
    const borrar = me.role === 'admin' && !c.anonymized_at ? h('button', { className: 'b', style: 'border-color:#a32;color:#a32', on: { click: async () => {
      if (!confirm(`¿Eliminar los datos personales de «${c.full_name}»?\n\nSe borran nombre, organización, correo, teléfono, mensaje, notas y ubicación. El contacto queda archivado. No se puede deshacer.`)) return;
      const { error } = await sb.rpc('anonymize_contact', { p_contact_id: cid });
      if (error) { msg.textContent = 'No se pudieron eliminar los datos personales.'; return; } detalle(cid); if (tab === 'contactos') ir('contactos'); } } }, 'Eliminar datos personales') : null;
    const permiso = !edita ? h('p', { className: 'mu' }, `Asignado a ${nombreStaff(c.assignee_id)}: solo esa persona o un administrador puede modificarlo.`)
      : !esAdmin && !c.assignee_id ? h('p', { className: 'mu' }, 'Este contacto no tiene responsable: al guardar cambios quedará asignado a ti.') : null;
    if (!edita) [ist, ifu, guardar, nt, nx, addNota].forEach((e) => { e.disabled = true; });
    const sitios = (locs || []).map((l) => {
      const ult = (l.waterbody_assessments || []).sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))[0], se = sel(SITIO, ult ? ult.status : 'sin_evaluar', { disabled: !edita }), sn = h('input', { placeholder: 'Evidencia / notas de la evaluación', value: ult && ult.notes || '', disabled: !edita });
      return h('div', { className: 'card' }, h('b', {}, l.waterbody_name || 'Ubicación indicada en el mapa'), h('div', { className: 'mu' }, [l.municipality, l.state, l.country].filter(Boolean).join(', ') || '—'),
        h('div', { className: 'mu' }, l.latitude != null ? `Pin aproximado: ${l.latitude}, ${l.longitude} · consentimiento: ${l.consent_to_use_location ? 'sí' : 'no'}` : 'Sin pin'),
        h('div', { className: 'row', style: 'margin:.5rem 0 0' }, h('label', {}, 'Evaluación del sitio (independiente del estado comercial)', se), sn,
          h('button', { className: 'b', disabled: !edita, on: { click: async () => { const { error } = await sb.from('waterbody_assessments').insert({ location_id: l.id, status: se.value, notes: sn.value.trim() || null, reviewed_by: me.user_id }); msg.textContent = error ? 'No se pudo guardar la evaluación.' : ''; if (!error) detalle(cid); } } }, 'Guardar evaluación')));
    });
    dlg.replaceChildren(h('div', { className: 'row' }, h('h2', { style: 'margin:0;flex:1' }, c.full_name), h('button', { className: 'b', on: { click: () => dlg.close() } }, 'Cerrar')),
      h('p', {}, h('b', {}, 'Organización: '), c.organization || '—', h('br'), h('b', {}, 'Correo: '), c.email, h('br'), h('b', {}, 'Teléfono: '), c.phone || '—', h('br'), h('b', {}, 'Interés: '), c.interest_type || '—', h('br'), h('b', {}, 'País: '), c.country || '—', h('br'), h('b', {}, 'Recibido: '), fmt(c.created_at), c.anonymized_at ? [h('br'), h('b', {}, 'Datos personales eliminados: '), fmt(c.anonymized_at)] : null),
      h('div', { className: 'card', style: 'white-space:pre-wrap' }, c.message || '(sin mensaje)'),
      h('div', { className: 'row', style: 'margin-top:1rem' }, h('label', {}, 'Estado comercial', ist), h('label', {}, 'Responsable', ias), h('label', {}, 'Próximo seguimiento', ifu), guardar, borrar), permiso,
      ...(sitios.length ? [h('h3', {}, 'Ubicación indicada'), ...sitios] : []), msg,
      h('h3', {}, 'Línea de tiempo'), h('ul', { className: 'tl' }, ...(hist || []).map((x) => h('li', {}, h('b', {}, x.type === 'cambio_de_estado' ? `Estado: ${ESTADOS[x.status_before] || '—'} → ${ESTADOS[x.status_after]}` : x.type), h('span', { className: 'mu' }, ` · ${fmt(x.created_at)} · ${x.author_id ? nombreStaff(x.author_id) : 'Formulario'}`), x.note ? h('div', { style: 'white-space:pre-wrap' }, x.note) : null))),
      h('div', { className: 'row' }, h('label', {}, 'Tipo', nt), h('label', { style: 'flex:1' }, 'Nueva entrada', nx), addNota));
  }

  // Pestaña Equipo (solo admin). Las cuentas se crean en Supabase → Authentication → Users; aquí se les da o retira acceso.
  async function vEquipo(v) {
    if (me.role !== 'admin') { v.append(h('p', { className: 'err' }, 'Solo un administrador puede gestionar el equipo.')); return; }
    const msg = h('p', { className: 'err', role: 'alert' }), lista = h('div', { className: 'scroll' });
    const errorTexto = (e) => /last_admin/.test(e.message) ? 'Debe quedar al menos un administrador.'
      : /user_not_found/.test(e.message) ? 'No existe una cuenta con ese correo. Créala primero en Supabase → Authentication → Users.'
      : 'No se pudo completar la operación.';
    async function recargar() { await cargarEquipo(); ir('equipo'); }
    async function cargar() {
      const { data, error } = await sb.rpc('staff_directory'); lista.replaceChildren();
      if (error) { lista.append(h('p', { className: 'err' }, 'No se pudo cargar el equipo. ¿Ya se ejecutó la migración 2026-11-13 en Supabase?')); return; }
      lista.append(h('table', {}, h('thead', {}, h('tr', {}, ...['Nombre visible', 'Correo', 'Rol', 'Último acceso', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, ...data.map((s) => {
          const yo = s.user_id === me.user_id, nom = h('input', { value: s.display_name || '', maxLength: 80, 'aria-label': 'Nombre visible' }),
            rol = sel(ROLES, s.role, { 'aria-label': 'Rol' });
          const guardar = h('button', { className: 'b', on: { click: async () => {
            msg.textContent = ''; const { error: e } = await sb.from('staff_members').update({ display_name: nom.value.trim() || null, role: rol.value }).eq('user_id', s.user_id);
            if (e) { msg.textContent = errorTexto(e); return; } if (yo && rol.value !== 'admin') return entrar(); recargar(); } } }, 'Guardar');
          const retirar = yo ? h('span', { className: 'mu' }, '(tu cuenta)') : h('button', { className: 'b', style: 'border-color:#a32;color:#a32', on: { click: async () => {
            if (!confirm(`¿Retirar el acceso al panel de ${s.display_name || s.email}?\n\nSus contactos asignados quedarán sin responsable. La cuenta seguirá existiendo en Supabase.`)) return;
            msg.textContent = ''; const { error: e } = await sb.from('staff_members').delete().eq('user_id', s.user_id);
            if (e) { msg.textContent = errorTexto(e); return; } recargar(); } } }, 'Retirar acceso');
          return h('tr', {}, h('td', {}, nom), h('td', {}, s.email || '—'), h('td', {}, rol), h('td', {}, fmt(s.last_sign_in_at)), h('td', {}, guardar, ' ', retirar));
        }))));
    }
    const em = h('input', { type: 'email', placeholder: 'correo@ejemplo.org', autocomplete: 'off' }), nn = h('input', { placeholder: 'Nombre visible', maxLength: 80 }), nr = sel(ROLES, 'seguimiento');
    const agregar = h('button', { className: 'b p', on: { click: async () => {
      msg.textContent = ''; if (!em.value.trim()) { msg.textContent = 'Escribe el correo de la cuenta.'; return; }
      const { error } = await sb.rpc('add_staff_by_email', { p_email: em.value.trim(), p_role: nr.value, p_display_name: nn.value.trim() });
      if (error) { msg.textContent = errorTexto(error); return; } recargar(); } } }, 'Dar acceso');
    v.append(h('h2', {}, 'Equipo con acceso al panel'),
      h('p', { className: 'mu' }, 'Administrador: edita todos los contactos, reasigna responsables, elimina datos personales y gestiona el equipo. Seguimiento: ve todos los contactos, pero solo edita los asignados a sí o los que no tienen responsable (al editarlos, los toma).'),
      lista, msg, h('h3', {}, 'Dar acceso a una cuenta'),
      h('p', { className: 'mu' }, 'La cuenta debe existir antes en Supabase → Authentication → Users (con «Auto Confirm User»). Si ya tiene acceso, se actualizan su rol y nombre.'),
      h('div', { className: 'row' }, h('label', {}, 'Correo', em), h('label', {}, 'Nombre visible', nn), h('label', {}, 'Rol', nr), agregar));
    cargar();
  }

  const MAX_PINES = 2000;   // tope de pines en el mapa del panel (el agrupador de marcadores maneja bien esta cantidad)
  async function vMapa(v) {
    const cont = h('div', { id: 'mapa-ad' }), av = h('p', { className: 'mu', role: 'status' }); v.append(h('p', { className: 'mu' }, 'Pines aproximados que las personas indicaron (con su consentimiento), coloreados por estado comercial. La capa azul es una referencia oficial de cuerpos de agua (fuente indicada en cada polígono).'), cont, av);
    await Enjambre.cargar('../');
    await new Promise((ok, ko) => { if (L.markerClusterGroup) return ok(); const s = h('script', { src: '../vendor/leaflet.markercluster.js' }); s.onload = ok; s.onerror = ko; document.head.append(s); });
    const m = Enjambre.mapa(cont, { mundo: true }); Enjambre.capaAgua(m, Enjambre.aviso(av));
    const { data } = await sb.from('waterbody_locations').select('id,contact_id,waterbody_name,municipality,state,country,latitude,longitude,contacts(status)').not('latitude', 'is', null)
      .order('created_at', { ascending: false }).limit(MAX_PINES);
    if (data && data.length === MAX_PINES) v.insertBefore(h('p', { className: 'mu' }, `Se muestran los ${MAX_PINES} pines más recientes.`), cont);
    const g = L.markerClusterGroup().addTo(m);
    (data || []).forEach((l) => {
      const st = l.contacts && l.contacts.status, mk = L.circleMarker([l.latitude, l.longitude], { radius: 9, color: '#fff', weight: 2, fillColor: COLOR[st] || '#555', fillOpacity: 1 });
      const d = h('div', {}, h('b', {}, l.waterbody_name || 'Pin aproximado'), h('br'), [l.municipality, l.state, l.country].filter(Boolean).join(', ') || '—', h('br'), 'Estado: ' + (ESTADOS[st] || '—'), h('br'),
        h('button', { className: 'b', on: { click: () => detalle(l.contact_id) } }, 'Abrir contacto'));   // sin correo ni teléfono en el mapa
      mk.bindPopup(d); g.addLayer(mk);
    });
    if (data && data.length) m.fitBounds(g.getBounds().pad(0.3), { maxZoom: 9 });   // mapa global: encuadra los pines (en pantallas angostas el mundo no incluía México)
    const leyenda = h('p', { className: 'mu' }, ...Object.entries(ESTADOS).map(([k, l]) => h('span', { style: 'margin-right:.8rem;white-space:nowrap' }, h('i', { style: `display:inline-block;width:11px;height:11px;border-radius:50%;background:${COLOR[k]};margin-right:.3rem` }), l))); v.append(leyenda);
  }
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') entrar(); }); entrar();
})();
