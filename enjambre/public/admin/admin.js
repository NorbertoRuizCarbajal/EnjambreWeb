/* Panel privado. Toda la seguridad real está en Supabase (RLS): este código solo usa la clave PUBLICABLE.
   Los datos de visitantes se pintan SIEMPRE con textContent (nunca innerHTML) para evitar XSS. */
(() => {
  const cfg = window.ENJAMBRE_CFG || {}, $ = (s, r = document) => r.querySelector(s);
  const ESTADOS = { nuevo: 'Nuevo', contactado: 'Contactado', en_seguimiento: 'En seguimiento', reunion_programada: 'Reunión programada', propuesta_enviada: 'Propuesta enviada', contrato_concretado: 'Contrato concretado', cerrado_sin_conversion: 'Cerrado sin conversión', archivado: 'Archivado' };
  const COLOR = { nuevo: '#e0245e', contactado: '#2f80ed', en_seguimiento: '#f2994a', reunion_programada: '#9b51e0', propuesta_enviada: '#f2c94c', contrato_concretado: '#27ae60', cerrado_sin_conversion: '#828282', archivado: '#bdbdbd' };
  const SITIO = { sin_evaluar: 'Sin evaluar', en_revision: 'En revisión', viable_preliminar: 'Viable preliminar', no_viable: 'No viable', viable_confirmada: 'Viable confirmada' };
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
    me = yo; const { data: eq } = await sb.from('staff_members').select('user_id,display_name,role'); staff = eq || [];
    $('#login').hidden = true; $('#app').hidden = false; ir(tab);
  }
  $('#lg').onclick = async () => {
    $('#le').textContent = ''; const { error } = await sb.auth.signInWithPassword({ email: $('#lm').value.trim(), password: $('#lp').value });
    if (error) { $('#le').textContent = 'Correo o contraseña incorrectos.'; return; } $('#lp').value = ''; entrar();
  };
  $('#lp').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#lg').click(); });
  $('#out').onclick = async () => { await sb.auth.signOut(); entrar(); };
  document.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => ir(b.dataset.t)));
  const nombreStaff = (id) => { const s = staff.find((x) => x.user_id === id); return s ? (s.display_name || 'Sin nombre') : 'Sin asignar'; };

  function ir(t) {
    tab = t; document.querySelectorAll('[data-t]').forEach((b) => b.setAttribute('aria-current', b.dataset.t === t));
    const v = $('#vista'); v.replaceChildren(); ({ resumen: vResumen, contactos: vContactos, mapa: vMapa })[t](v);
  }

  async function vResumen(v) {
    const { data, error } = await sb.rpc('staff_summary'); if (error) { v.append(h('p', { className: 'err' }, 'No se pudo cargar el resumen.')); return; }
    const k = [['Contactos nuevos', data.nuevos], ['Seguimientos vencidos', data.seguimientos_vencidos], ['Propuestas enviadas', data.propuestas_enviadas], ['Contratos concretados', data.contratos_concretados], ['Contactos cerrados', data.cerrados]];
    v.append(h('div', { className: 'kpi' }, ...k.map(([l, n]) => h('div', { className: 'card' }, h('b', {}, String(n ?? 0)), l))));
  }

  async function vContactos(v) {
    const f = { q: '', status: '', interest: '', assignee: '', desde: '' };
    const lista = h('div', { className: 'scroll' }), cuenta = h('p', { className: 'mu' });
    const ctl = (l, el) => h('label', {}, l, el);
    const iq = h('input', { type: 'search', placeholder: 'Nombre, organización o correo' }), is = sel({ '': 'Todos', ...ESTADOS }, ''), ii = sel({ '': 'Todos', ...Object.fromEntries(INTERESES.map((x) => [x, x])) }, ''),
      ia = sel({ '': 'Todos', none: 'Sin asignar', ...Object.fromEntries(staff.map((s) => [s.user_id, s.display_name || 'Sin nombre'])) }, ''), id = h('input', { type: 'date' });
    async function cargar() {
      let q = sb.from('contacts').select('id,created_at,full_name,organization,interest_type,status,assignee_id,next_follow_up_at').order('created_at', { ascending: false }).limit(500);
      if (iq.value.trim()) { const s = iq.value.trim().replace(/[,()%*\\]/g, ' '); q = q.or(`full_name.ilike.%${s}%,organization.ilike.%${s}%,email.ilike.%${s}%`); }
      if (is.value) q = q.eq('status', is.value); if (ii.value) q = q.eq('interest_type', ii.value);
      if (ia.value === 'none') q = q.is('assignee_id', null); else if (ia.value) q = q.eq('assignee_id', ia.value);
      if (id.value) q = q.gte('created_at', id.value);
      const { data, error } = await q; lista.replaceChildren();
      if (error) { lista.append(h('p', { className: 'err' }, 'No se pudieron cargar los contactos.')); return; }
      cuenta.textContent = data.length + ' contacto(s)' + (data.length === 500 ? ' (mostrando los 500 más recientes)' : '');
      lista.append(h('table', {}, h('thead', {}, h('tr', {}, ...['Fecha', 'Nombre', 'Estado', 'Organización', 'Interés', 'Responsable', 'Seguimiento'].map((t) => h('th', {}, t)))),
        h('tbody', {}, ...data.map((c) => h('tr', { className: 'c', tabIndex: 0, on: { click: () => detalle(c.id), keydown: (e) => { if (e.key === 'Enter') detalle(c.id); } } },
          h('td', {}, fmt(c.created_at)), h('td', {}, c.full_name), h('td', {}, h('span', { className: 'tag' }, ESTADOS[c.status])), h('td', {}, c.organization || '—'), h('td', {}, c.interest_type || '—'), h('td', {}, nombreStaff(c.assignee_id)), h('td', {}, fmt(c.next_follow_up_at)))))));
    }
    [is, ii, ia, id].forEach((e) => e.addEventListener('change', cargar)); iq.addEventListener('input', () => { clearTimeout(iq.t); iq.t = setTimeout(cargar, 300); });
    v.append(h('div', { className: 'row' }, ctl('Buscar', iq), ctl('Estado', is), ctl('Interés', ii), ctl('Responsable', ia), ctl('Desde', id)), cuenta, lista); cargar();
  }

  async function detalle(cid) {
    const dlg = $('#dlg'); dlg.replaceChildren(h('p', {}, 'Cargando…')); dlg.showModal();
    const [{ data: c }, { data: hist }, { data: locs }] = await Promise.all([
      sb.from('contacts').select('*').eq('id', cid).single(),
      sb.from('contact_interactions').select('*').eq('contact_id', cid).order('created_at'),
      sb.from('waterbody_locations').select('*, waterbody_assessments(status,notes,reviewed_at)').eq('contact_id', cid)]);
    if (!c) { dlg.replaceChildren(h('p', { className: 'err' }, 'No se pudo cargar el contacto.'), h('button', { className: 'b', on: { click: () => dlg.close() } }, 'Cerrar')); return; }
    const msg = h('p', { className: 'err', role: 'alert' });
    const ist = sel(ESTADOS, c.status), ias = sel({ '': 'Sin asignar', ...Object.fromEntries(staff.map((s) => [s.user_id, s.display_name || 'Sin nombre'])) }, c.assignee_id || ''),
      ifu = h('input', { type: 'datetime-local', value: c.next_follow_up_at ? new Date(new Date(c.next_follow_up_at) - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '' });
    const guardar = h('button', { className: 'b p', on: { click: async () => {
      const { error } = await sb.from('contacts').update({ status: ist.value, assignee_id: ias.value || null, next_follow_up_at: ifu.value ? new Date(ifu.value).toISOString() : null }).eq('id', cid);
      if (error) { msg.textContent = 'No se pudo guardar.'; return; } detalle(cid); if (tab === 'contactos') ir('contactos'); } } }, 'Guardar cambios');
    const nt = h('select', {}, ...['nota', 'llamada', 'correo', 'reunion'].map((t) => h('option', { value: t }, t === 'reunion' ? 'reunión' : t))), nx = h('textarea', { rows: 3, maxLength: 2000, placeholder: 'Nota interna' });
    const addNota = h('button', { className: 'b', on: { click: async () => {
      if (!nx.value.trim()) return; const { error } = await sb.from('contact_interactions').insert({ contact_id: cid, author_id: me.user_id, type: nt.value, note: nx.value.trim() });
      if (error) { msg.textContent = 'No se pudo guardar la nota.'; return; } detalle(cid); } } }, 'Agregar a la línea de tiempo');
    const sitios = (locs || []).map((l) => {
      const ult = (l.waterbody_assessments || []).sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))[0], se = sel(SITIO, ult ? ult.status : 'sin_evaluar'), sn = h('input', { placeholder: 'Evidencia / notas de la evaluación', value: ult && ult.notes || '' });
      return h('div', { className: 'card' }, h('b', {}, l.waterbody_name || 'Ubicación indicada en el mapa'), h('div', { className: 'mu' }, [l.municipality, l.state, l.country].filter(Boolean).join(', ') || '—'),
        h('div', { className: 'mu' }, l.latitude != null ? `Pin aproximado: ${l.latitude}, ${l.longitude} · consentimiento: ${l.consent_to_use_location ? 'sí' : 'no'}` : 'Sin pin'),
        h('div', { className: 'row', style: 'margin:.5rem 0 0' }, h('label', {}, 'Evaluación del sitio (independiente del estado comercial)', se), sn,
          h('button', { className: 'b', on: { click: async () => { const { error } = await sb.from('waterbody_assessments').insert({ location_id: l.id, status: se.value, notes: sn.value.trim() || null, reviewed_by: me.user_id }); msg.textContent = error ? 'No se pudo guardar la evaluación.' : ''; if (!error) detalle(cid); } } }, 'Guardar evaluación')));
    });
    dlg.replaceChildren(h('div', { className: 'row' }, h('h2', { style: 'margin:0;flex:1' }, c.full_name), h('button', { className: 'b', on: { click: () => dlg.close() } }, 'Cerrar')),
      h('p', {}, h('b', {}, 'Organización: '), c.organization || '—', h('br'), h('b', {}, 'Correo: '), c.email, h('br'), h('b', {}, 'Teléfono: '), c.phone || '—', h('br'), h('b', {}, 'Interés: '), c.interest_type || '—', h('br'), h('b', {}, 'País: '), c.country || '—', h('br'), h('b', {}, 'Recibido: '), fmt(c.created_at)),
      h('div', { className: 'card', style: 'white-space:pre-wrap' }, c.message || '(sin mensaje)'),
      h('div', { className: 'row', style: 'margin-top:1rem' }, h('label', {}, 'Estado comercial', ist), h('label', {}, 'Responsable', ias), h('label', {}, 'Próximo seguimiento', ifu), guardar),
      ...(sitios.length ? [h('h3', {}, 'Ubicación indicada'), ...sitios] : []), msg,
      h('h3', {}, 'Línea de tiempo'), h('ul', { className: 'tl' }, ...(hist || []).map((x) => h('li', {}, h('b', {}, x.type === 'cambio_de_estado' ? `Estado: ${ESTADOS[x.status_before] || '—'} → ${ESTADOS[x.status_after]}` : x.type), h('span', { className: 'mu' }, ` · ${fmt(x.created_at)} · ${x.author_id ? nombreStaff(x.author_id) : 'Formulario'}`), x.note ? h('div', { style: 'white-space:pre-wrap' }, x.note) : null))),
      h('div', { className: 'row' }, h('label', {}, 'Tipo', nt), h('label', { style: 'flex:1' }, 'Nueva entrada', nx), addNota));
  }

  async function vMapa(v) {
    const cont = h('div', { id: 'mapa-ad' }), av = h('p', { className: 'mu', role: 'status' }); v.append(h('p', { className: 'mu' }, 'Pines aproximados que las personas indicaron (con su consentimiento), coloreados por estado comercial. La capa azul es la referencia oficial de CONAGUA.'), cont, av);
    await Enjambre.cargar('../');
    await new Promise((ok, ko) => { if (L.markerClusterGroup) return ok(); const s = h('script', { src: '../vendor/leaflet.markercluster.js' }); s.onload = ok; s.onerror = ko; document.head.append(s); });
    const m = Enjambre.mapa(cont, { mundo: true }); Enjambre.capaAgua(m, Enjambre.aviso(av));
    const { data } = await sb.from('waterbody_locations').select('id,contact_id,waterbody_name,municipality,state,country,latitude,longitude,contacts(status)').not('latitude', 'is', null);
    const g = L.markerClusterGroup().addTo(m);
    (data || []).forEach((l) => {
      const st = l.contacts && l.contacts.status, mk = L.circleMarker([l.latitude, l.longitude], { radius: 9, color: '#fff', weight: 2, fillColor: COLOR[st] || '#555', fillOpacity: 1 });
      const d = h('div', {}, h('b', {}, l.waterbody_name || 'Pin aproximado'), h('br'), [l.municipality, l.state, l.country].filter(Boolean).join(', ') || '—', h('br'), 'Estado: ' + (ESTADOS[st] || '—'), h('br'),
        h('button', { className: 'b', on: { click: () => detalle(l.contact_id) } }, 'Abrir contacto'));   // sin correo ni teléfono en el mapa
      mk.bindPopup(d); g.addLayer(mk);
    });
    const leyenda = h('p', { className: 'mu' }, ...Object.entries(ESTADOS).map(([k, l]) => h('span', { style: 'margin-right:.8rem;white-space:nowrap' }, h('i', { style: `display:inline-block;width:11px;height:11px;border-radius:50%;background:${COLOR[k]};margin-right:.3rem` }), l))); v.append(leyenda);
  }
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') entrar(); }); entrar();
})();
