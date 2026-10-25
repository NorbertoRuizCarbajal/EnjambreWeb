/* Mapas de Enjambre. Leaflet se descarga solo cuando hace falta (vendor/ local, sin CDN).
   Usado por la landing (mapa público + pin del formulario) y por /admin (con base="../"). */
(function () {
  const MX = [[14, -119], [33.5, -86]], CENTRO = [23.6, -102.5];
  let promesa;
  function cargar(base) {
    base = base || '';
    return promesa || (promesa = new Promise((ok, ko) => {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = base + 'vendor/leaflet/leaflet.css'; document.head.appendChild(l);
      const s = document.createElement('script'); s.src = base + 'vendor/leaflet/leaflet.js';
      s.onload = () => { L.Icon.Default.imagePath = base + 'vendor/leaflet/images/'; ok(); }; s.onerror = ko; document.head.appendChild(s);
    }));
  }
  function mapa(el, o) {
    const mundo = o && o.mundo;   // mapas con pines (formulario y panel): todo el planeta; mapa de cuerpos de agua: México
    const m = L.map(el, mundo ? { center: [20, 0], zoom: 2, minZoom: 2, worldCopyJump: true } : { center: CENTRO, zoom: 5, minZoom: 4, maxBounds: [[8, -125], [38, -80]] });
    if ('ResizeObserver' in window) new ResizeObserver(() => m.invalidateSize()).observe(el);   // acordeones, giro de pantalla, teclado virtual
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
    return m;
  }
  function nombreDe(p) {
    for (const k in p) if (/^(nombre|nom|name)/i.test(k) && typeof p[k] === 'string' && p[k].trim()) return p[k].trim();
    return '';
  }
  // Capa oficial CONAGUA: se consulta por área visible (bbox) y zoom ≥ 8 a través de /api/conagua.
  function motivo(st, j) {
    const c = String(j.cause || '');
    if (st === 404 || st === 405) return 'el servicio /api/conagua no está publicado en este sitio';
    if (/VERIFY|CERT|SELF_SIGNED/.test(c)) return 'el certificado del servidor de CONAGUA no pudo verificarse';
    if (/ENOTFOUND|EAI_AGAIN/.test(c)) return 'no se encontró el servidor de CONAGUA';
    if (/Timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED/.test(c)) return 'el servidor de CONAGUA no respondió a tiempo';
    if (j.status) return 'CONAGUA respondió con el código ' + j.status;
    if (j.detail) return 'CONAGUA devolvió un error: ' + j.detail;
    return 'motivo no identificado; abre /api/health para ver el detalle';
  }
  function mkAviso(el) {
    return (t, fn) => { el.replaceChildren(t || ''); if (fn) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn s'; b.textContent = 'Reintentar'; b.style.cssText = 'margin-left:.6rem;min-height:44px;padding:.3rem 1rem'; b.onclick = fn; el.append(b); } };
  }
  function capaAgua(m, aviso, alCargar) {
    const g = L.geoJSON(null, {
      style: { color: '#0f8fb0', weight: 1, fillColor: '#27b8dc', fillOpacity: .45 },
      onEachFeature(f, l) {
        const d = document.createElement('div'), b = document.createElement('strong'), p = document.createElement('p');
        b.textContent = nombreDe(f.properties || {}) || 'Cuerpo de agua (sin nombre en la fuente)';
        p.textContent = 'Referencia oficial · Fuente: CONAGUA. Requiere evaluación técnica, operativa y de permisos.';
        p.style.margin = '.4rem 0 0'; d.append(b, p); l.bindPopup(d);
      },
    }).addTo(m);
    let ctl, t;
    async function pedir() {
      const z = m.getZoom();
      if (z < 8) { g.clearLayers(); aviso('Acerca el mapa para ver los cuerpos de agua de referencia.'); return; }
      const b = m.getBounds();
      if (ctl) ctl.abort(); ctl = new AbortController(); aviso('Cargando cuerpos de agua…');
      try {
        const r = await fetch('/api/conagua?bbox=' + [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(4)) + '&z=' + z, { signal: ctl.signal });
        if (!r.ok) { let j = {}; try { j = await r.json(); } catch { /* respuesta no JSON (p. ej. 404 de Netlify) */ } const e = new Error('capa'); e.motivo = motivo(r.status, j); e.detalle = { status: r.status, ...j }; throw e; }
        const d = await r.json(); g.clearLayers(); g.addData(d);
        if (alCargar && d.features && d.features.length) alCargar();
        aviso(d.exceededTransferLimit ? 'Hay más cuerpos de agua en esta zona: acerca el mapa para verlos.' : (d.features && d.features.length ? '' : 'No hay cuerpos de agua de referencia en esta vista.'));
      } catch (e) { if (e.name !== 'AbortError') { console.error('[capa CONAGUA]', e.detalle || e); aviso('No se pudo cargar la capa de referencia (' + (e.motivo || 'sin conexión con el servicio') + '); el mapa base sigue disponible.', pedir); } }
    }
    m.on('moveend', () => { clearTimeout(t); t = setTimeout(pedir, 350); });
    pedir(); return g;
  }
  // Búsqueda por lugar (Nominatim/OSM). Solo al enviar la búsqueda; sin autocompletado (política de uso).
  async function buscar(m, q, cc) {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1' + (cc ? '&countrycodes=' + cc.toLowerCase() : '') + '&q=' + encodeURIComponent(q), { headers: { accept: 'application/json' } });
    const d = await r.json();
    if (!d.length) return false;
    m.setView([+d[0].lat, +d[0].lon], 11); return true;
  }
  function enMexico(lat, lng) { return lat >= 14 && lat <= 33 && lng >= -119 && lng <= -86; }

  // Selector de país (valor = código ISO 3166-1; nombres en español del propio navegador)
  const ISO = 'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');
  function poblarPaises() {
    const s = document.getElementById('pais'); if (!s || s.dataset.ok) return; s.dataset.ok = 1;
    let dn; try { dn = new Intl.DisplayNames(['es'], { type: 'region' }); } catch { return; }   // sin soporte: queda México
    const l = ISO.map((c) => [c, dn.of(c)]).filter(([c, n]) => n && n !== c).sort((a, b) => a[1].localeCompare(b[1], 'es'));
    const mx = l.findIndex(([c]) => c === 'MX'); if (mx > 0) l.unshift(l.splice(mx, 1)[0]);
    s.replaceChildren(...l.map(([c, n]) => { const o = document.createElement('option'); o.value = c; o.textContent = n; return o; })); s.value = 'MX';
  }
  const BOX = { MX: [[14.5, -118.5], [32.8, -86.5]] }, cacheBox = {};
  async function irAPais(m, cc, nombre) {          // centra el mapa en el país elegido (sin limitarlo)
    if (BOX[cc]) { m.fitBounds(BOX[cc]); return; }
    try {
      if (!cacheBox[cc]) { const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=' + cc.toLowerCase() + '&q=' + encodeURIComponent(nombre), { headers: { accept: 'application/json' } }); const d = await r.json(); if (d[0] && d[0].boundingbox) { const b = d[0].boundingbox.map(Number); cacheBox[cc] = [[b[0], b[2]], [b[1], b[3]]]; } }
      if (cacheBox[cc]) m.fitBounds(cacheBox[cc]);
    } catch { /* si falla, el mapa se queda donde está */ }
  }

  // Mapa público de referencia
  function iniciarPublico() {
    const cont = document.getElementById('mapa-pub'); if (!cont || cont.dataset.ok) return; cont.dataset.ok = 1;
    const av = document.getElementById('mapa-aviso'), f = document.getElementById('mapa-bus'), q = document.getElementById('mapa-q');
    cargar('').then(() => {
      const m = mapa(cont); capaAgua(m, mkAviso(av), () => { const l = document.getElementById('ley-of'); if (l) l.hidden = false; });
      f.addEventListener('submit', async (e) => {
        e.preventDefault(); if (!q.value.trim()) return; av.textContent = 'Buscando…';
        try { av.textContent = (await buscar(m, q.value.trim(), 'mx')) ? '' : 'No encontramos ese lugar en México.'; } catch { av.textContent = 'No se pudo realizar la búsqueda.'; }
      });
    }).catch(() => { av.textContent = 'No se pudo cargar el mapa.'; });
  }

  // Selector de ubicación aproximada del formulario (opcional)
  function iniciarPin() {
    const box = document.getElementById('pinbox'); if (!box) return;
    const lat = document.querySelector('[name=lat]'), lng = document.querySelector('[name=lng]'), cons = document.getElementById('cons'),
      chk = cons.querySelector('input'), quit = document.getElementById('pquit'), ok = document.getElementById('pok'), st = document.getElementById('pst'),
      res = document.getElementById('pres'), pais = document.getElementById('pais');
    let m, mk;
    const sel = () => ({ cc: pais ? pais.value : 'MX', nombre: pais && pais.selectedOptions[0] ? pais.selectedOptions[0].textContent : 'México' });
    function poner(la, lo) {
      st.textContent = 'Pin colocado (ubicación aproximada). Puedes arrastrarlo o confirmarlo.';
      lat.value = (Math.round(la * 100) / 100).toFixed(2); lng.value = (Math.round(lo * 100) / 100).toFixed(2);
      if (!mk) { mk = L.marker([la, lo], { draggable: true, keyboard: false }).addTo(m); mk.on('dragend', () => { const p = mk.getLatLng(); poner(p.lat, p.lng); }); } else mk.setLatLng([la, lo]);
      cons.hidden = false; chk.required = true; quit.hidden = false; ok.hidden = false; res.hidden = true;
    }
    function quitar() {
      if (mk) { mk.remove(); mk = null; } lat.value = lng.value = ''; cons.hidden = true; chk.required = false; chk.checked = false; quit.hidden = true; ok.hidden = true; res.hidden = true; st.textContent = '';
    }
    quit.addEventListener('click', quitar);
    ok.addEventListener('click', () => { res.textContent = 'Ubicación aproximada marcada. Puedes reabrir el mapa para cambiarla o quitarla.'; res.hidden = false; box.open = false; });
    window.Enjambre.resetPin = () => { quitar(); if (m) { const s = sel(); irAPais(m, s.cc, s.nombre); } };
    if (pais) pais.addEventListener('change', () => { if (m) { const s = sel(); irAPais(m, s.cc, s.nombre); } });
    box.addEventListener('toggle', () => {
      if (!box.open) return;
      if (m) { m.invalidateSize(); return; }
      cargar('').then(() => {
        m = mapa(document.getElementById('pmap'), { mundo: true }); m.on('click', (e) => poner(e.latlng.lat, e.latlng.lng));
        const s = sel(); irAPais(m, s.cc, s.nombre);
        const q = document.getElementById('pbq'), go = async () => {
          const v = q.value.trim(); if (!v) return; st.textContent = 'Buscando…';
          try { st.textContent = (await buscar(m, v, sel().cc)) ? 'Toca el mapa para colocar el pin.' : 'No encontramos ese lugar en el país elegido.'; } catch { st.textContent = 'No se pudo realizar la búsqueda.'; }
        };
        document.getElementById('pbb').addEventListener('click', go);
        q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      }).catch(() => { st.textContent = 'No se pudo cargar el mapa. Puedes enviar el formulario sin ubicación.'; });
    });
  }

  window.Enjambre = Object.assign(window.Enjambre || {}, { cargar, mapa, capaAgua, aviso: mkAviso, iniciarPublico, iniciarPin });
  document.addEventListener('DOMContentLoaded', () => {
    poblarPaises(); iniciarPin();
    const s = document.getElementById('mapa');
    if (s && 'IntersectionObserver' in window) new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); iniciarPublico(); } }, { rootMargin: '300px' }).observe(s);
    else iniciarPublico();
  });
})();
