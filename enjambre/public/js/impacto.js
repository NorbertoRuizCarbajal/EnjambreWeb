/* Sección "El impacto que no podemos ignorar". Lee data/impacto.json y pinta tarjetas con textContent (sin innerHTML).
   Para agregar contenido NO hace falta tocar este archivo: ver docs/IMPACTO.md. Si el JSON falla, el resto de la página sigue igual. */
(function () {
  const NIVEL = { dato: 'Dato reportado', atribucion: 'Atribución de la autoridad', riesgo: 'Riesgo señalado', referencia: 'Caso de referencia', propio: 'Registro propio', factor: 'Factor contribuyente' };
  const TIPO = { noticia: 'Noticia', video: 'Video', fotografia: 'Fotografía', informe: 'Informe' };
  const ICON = {
    noticia: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2V5zm13 3h3v9a2 2 0 0 1-2 2M7 8h7M7 12h7M7 16h4"/>',
    informe: '<path d="M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
    fotografia: '<rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>',
  };
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  const seguro = (u) => { try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
  const fechaTxt = (f) => new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

  function media(it) {
    const ph = el('div', 'ia-ph'); ph.setAttribute('aria-hidden', it.imagen ? 'false' : 'true');
    if (it.imagen) { const i = el('img'); i.src = it.imagen; i.alt = it.alt || ''; i.loading = 'lazy'; i.onerror = () => i.remove(); ph.append(i); }
    else { ph.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (ICON[it.tipo] || ICON.noticia) + '</svg>'; }  // icono fijo, sin datos externos
    return ph;
  }
  function tarjeta(it, destacada) {
    const c = el('article', 'ia-c' + (destacada ? ' ia-dest' : '')); c.setAttribute('role', 'listitem');
    const b = el('div', 'ia-b'), tags = el('div', 'ia-m');
    tags.append(el('span', 'ia-tag', TIPO[it.tipo] || 'Contenido'), el('span', 'ia-tag', it.categoria || ''), el('span', 'ia-tag n', NIVEL[it.nivel] || ''));
    b.append(tags);
    if (destacada && it.cifra) { const k = el('div', 'ia-cifra', it.cifra); k.append(el('small', '', it.cifra_texto || '')); b.append(k); }
    b.append(el('h3', '', it.titulo), el('p', '', it.resumen));
    const pie = [it.fuente, it.fecha ? fechaTxt(it.fecha) : (it.consultado ? 'consultado el ' + fechaTxt(it.consultado) : ''), it.credito ? 'Foto: ' + it.credito : ''].filter(Boolean).join(' · ');
    b.append(el('div', 'ia-f', pie));
    const u = it.url && seguro(it.url);
    if (u) { const a = el('a', 'ia-l', 'Leer la fuente original'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.setAttribute('aria-label', 'Leer la fuente original de «' + it.titulo + '» en ' + it.fuente + ' (se abre en una pestaña nueva)'); b.append(a); }
    else if (it.video) {                                         // video local: se abre en un diálogo, sin audio ni reproducción automática
      const bt = el('button', 'btn s', 'Ver video'); bt.type = 'button'; bt.onclick = () => abrirVideo(it); b.append(bt);
    }
    c.append(media(it), b); return c;
  }
  function abrirVideo(it) {
    const d = el('dialog'); d.setAttribute('aria-label', it.titulo);
    const v = el('video'); v.controls = true; v.preload = 'metadata'; v.src = it.video; v.setAttribute('playsinline', ''); v.style.cssText = 'width:100%;max-height:70vh';
    const x = el('button', 'btn s', 'Cerrar'); x.type = 'button'; x.onclick = () => d.close(); d.addEventListener('close', () => { v.pause(); d.remove(); });
    d.append(v, x); document.body.append(d); d.showModal();
  }
  async function iniciar() {
    const dest = document.getElementById('ia-dest'), grid = document.getElementById('ia-grid'), st = document.getElementById('ia-estado');
    if (!grid) return;
    try {
      const r = await fetch('data/impacto.json', { cache: 'no-cache' }); if (!r.ok) throw 0;
      const d = await r.json(), items = (d.items || []).filter((i) => i && i.titulo && i.resumen);
      const f = items.find((i) => i.id === d.destacado) || null;
      if (f) dest.append(tarjeta(f, true));
      items.filter((i) => i !== f).forEach((i) => grid.append(tarjeta(i, false)));
    } catch { st.textContent = 'No se pudo cargar el contenido de esta sección en este momento.'; return; }
    const cards = [...document.querySelectorAll('.ia-c')];
    if (!('IntersectionObserver' in window)) { cards.forEach((c) => c.classList.add('vis')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    cards.forEach((c) => io.observe(c));
  }
  document.addEventListener('DOMContentLoaded', iniciar);
})();
