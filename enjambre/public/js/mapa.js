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
  function mapa(el) {
    const m = L.map(el, { center: CENTRO, zoom: 5, minZoom: 4, maxBounds: [[8, -125], [38, -80]], worldCopyJump: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
    return m;
  }
  function nombreDe(p) {
    for (const k in p) if (/^(nombre|nom|name)/i.test(k) && typeof p[k] === 'string' && p[k].trim()) return p[k].trim();
    return '';
  }
  // Capa oficial CONAGUA: se consulta por área visible (bbox) y zoom ≥ 8 a través de /api/conagua.
  function capaAgua(m, aviso) {
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
        if (!r.ok) throw 0;
        const d = await r.json(); g.clearLayers(); g.addData(d);
        aviso(d.exceededTransferLimit ? 'Hay más cuerpos de agua en esta zona: acerca el mapa para verlos.' : (d.features && d.features.length ? '' : 'No hay cuerpos de agua de referencia en esta vista.'));
      } catch (e) { if (e.name !== 'AbortError') aviso('No se pudo cargar la capa de referencia. Inténtalo de nuevo.'); }
    }
    m.on('moveend', () => { clearTimeout(t); t = setTimeout(pedir, 350); });
    pedir(); return g;
  }
  // Búsqueda por lugar (Nominatim/OSM). Solo al enviar la búsqueda; sin autocompletado (política de uso).
  async function buscar(m, q) {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=mx&limit=1&q=' + encodeURIComponent(q), { headers: { accept: 'application/json' } });
    const d = await r.json();
    if (!d.length) return false;
    m.setView([+d[0].lat, +d[0].lon], 11); return true;
  }
  function enMexico(lat, lng) { return lat >= 14 && lat <= 33 && lng >= -119 && lng <= -86; }

  // Mapa público de referencia
  function iniciarPublico() {
    const cont = document.getElementById('mapa-pub'); if (!cont || cont.dataset.ok) return; cont.dataset.ok = 1;
    const av = document.getElementById('mapa-aviso'), f = document.getElementById('mapa-bus'), q = document.getElementById('mapa-q');
    cargar('').then(() => {
      const m = mapa(cont); capaAgua(m, (t) => { av.textContent = t; });
      f.addEventListener('submit', async (e) => {
        e.preventDefault(); if (!q.value.trim()) return; av.textContent = 'Buscando…';
        try { av.textContent = (await buscar(m, q.value.trim())) ? '' : 'No encontramos ese lugar en México.'; } catch { av.textContent = 'No se pudo realizar la búsqueda.'; }
      });
    }).catch(() => { av.textContent = 'No se pudo cargar el mapa.'; });
  }

  // Selector de ubicación aproximada del formulario (opcional)
  function iniciarPin() {
    const box = document.getElementById('pinbox'); if (!box) return;
    const lat = document.querySelector('[name=lat]'), lng = document.querySelector('[name=lng]'), cons = document.getElementById('cons'),
      chk = cons.querySelector('input'), quit = document.getElementById('pquit'), st = document.getElementById('pst');
    let m, mk;
    function poner(la, lo) {
      if (!enMexico(la, lo)) { st.textContent = 'Elige un punto dentro de México.'; return; }
      st.textContent = 'Pin colocado (ubicación aproximada).';
      lat.value = (Math.round(la * 100) / 100).toFixed(2); lng.value = (Math.round(lo * 100) / 100).toFixed(2);
      if (!mk) { mk = L.marker([la, lo], { draggable: true, keyboard: false }).addTo(m); mk.on('dragend', () => { const p = mk.getLatLng(); poner(p.lat, p.lng); }); } else mk.setLatLng([la, lo]);
      cons.hidden = false; chk.required = true; quit.hidden = false;
    }
    function quitar() {
      if (mk) { mk.remove(); mk = null; } lat.value = lng.value = ''; cons.hidden = true; chk.required = false; chk.checked = false; quit.hidden = true; st.textContent = '';
    }
    quit.addEventListener('click', quitar);
    window.Enjambre.resetPin = quitar;
    box.addEventListener('toggle', () => {
      if (!box.open) return;
      if (m) { m.invalidateSize(); return; }
      cargar('').then(() => {
        m = mapa(document.getElementById('pmap')); m.on('click', (e) => poner(e.latlng.lat, e.latlng.lng));
        const q = document.getElementById('pbq'), go = async () => {
          const v = q.value.trim(); if (!v) return; st.textContent = 'Buscando…';
          try { st.textContent = (await buscar(m, v)) ? 'Toca el mapa para colocar el pin.' : 'No encontramos ese lugar en México.'; } catch { st.textContent = 'No se pudo realizar la búsqueda.'; }
        };
        document.getElementById('pbb').addEventListener('click', go);
        q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      }).catch(() => { st.textContent = 'No se pudo cargar el mapa. Puedes enviar el formulario sin ubicación.'; });
    });
  }

  window.Enjambre = Object.assign(window.Enjambre || {}, { cargar, mapa, capaAgua, iniciarPublico, iniciarPin });
  document.addEventListener('DOMContentLoaded', () => {
    iniciarPin();
    const s = document.getElementById('mapa');
    if (s && 'IntersectionObserver' in window) new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); iniciarPublico(); } }, { rootMargin: '300px' }).observe(s);
    else iniciarPublico();
  });
})();
