/* Sección "El impacto que no podemos ignorar". Lee data/impacto.json y arma un carrusel (una noticia a la vez) con textContent (sin innerHTML).
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
  const MAX_NOTICIAS = 3;   // noticias en el carrusel (criterio editorial de docs/IMPACTO.md); se puede subir sin tocar el diseño
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  const seguro = (u) => { try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
  const fechaTxt = (f) => new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

  function icono(ph, tipo) {                                       // estado alternativo: SOLO cuando la foto falta o no carga
    ph.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[tipo] || ICON.noticia) + '</svg>';  // SVG fijo, sin datos externos
  }
  function media(it) {
    const ph = el('div', 'ia-ph');
    if (it.imagen) {
      const i = el('img'); i.alt = it.alt || ''; i.loading = 'lazy'; i.decoding = 'async'; i.src = it.imagen;
      i.onerror = () => { i.remove(); const cr = ph.querySelector('.cr'); if (cr) cr.remove(); icono(ph, it.tipo); };
      ph.append(i); if (it.credito) ph.append(el('span', 'cr', it.credito));
    } else icono(ph, it.tipo);
    return ph;
  }
  function tarjeta(it, n, total) {                               // cada noticia es una diapositiva con imagen y texto lado a lado
    const c = el('article', 'ia-c ia-dest');
    c.setAttribute('role', 'group'); c.setAttribute('aria-roledescription', 'diapositiva'); c.setAttribute('aria-label', `${n} de ${total}: ${it.titulo}`);
    const b = el('div', 'ia-b'), tags = el('div', 'ia-m');
    tags.append(el('span', 'ia-tag', TIPO[it.tipo] || 'Contenido'), el('span', 'ia-tag', it.categoria || ''), el('span', 'ia-tag n', NIVEL[it.nivel] || ''));
    b.append(tags);
    if (it.cifra) { const k = el('div', 'ia-cifra', it.cifra); k.append(el('small', '', it.cifra_texto || '')); b.append(k); }
    b.append(el('h3', '', it.titulo), el('p', '', it.resumen));
    const pie = [it.fuente, it.fecha ? fechaTxt(it.fecha) : (it.consultado ? 'consultado el ' + fechaTxt(it.consultado) : ''), ].filter(Boolean).join(' · ');
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
  // Carrusel: una noticia a la vez. Flecha derecha en la primera, ambas en las intermedias, izquierda en la última (sin ciclo).
  // También se navega con los puntos, con las flechas del teclado y deslizando en pantallas táctiles.
  function carrusel(car, slides) {
    const track = car.querySelector('#ia-track'), prev = car.querySelector('#ia-prev'), next = car.querySelector('#ia-next'),
      dots = car.querySelector('#ia-dots'), cont = car.querySelector('#ia-cont');
    let i = 0;
    const puntos = slides.map((_, n) => { const b = el('button'); b.type = 'button'; b.setAttribute('aria-label', 'Ir a la noticia ' + (n + 1)); b.onclick = () => ir(n); return b; });
    if (slides.length > 1) dots.append(...puntos);
    function ir(n, foco) {
      i = Math.max(0, Math.min(slides.length - 1, n));
      track.style.transform = `translateX(${-100 * i}%)`;
      slides.forEach((s, k) => { const fuera = k !== i; s.inert = fuera; s.setAttribute('aria-hidden', fuera); });   // las ocultas no reciben foco
      puntos.forEach((p, k) => p.setAttribute('aria-current', k === i));
      prev.hidden = i === 0; next.hidden = i === slides.length - 1;
      cont.textContent = slides.length > 1 ? `Noticia ${i + 1} de ${slides.length}` : '';
      if (foco) (i === 0 ? next : i === slides.length - 1 ? prev : foco).focus();   // si la flecha pulsada desaparece, el foco pasa a la otra
    }
    prev.onclick = () => ir(i - 1, prev); next.onclick = () => ir(i + 1, next);
    car.addEventListener('keydown', (e) => {
      if (e.target.closest('input,textarea,select')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); ir(i + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(i - 1); }
    });
    let x0 = null;                                                // deslizar con el dedo (o arrastrar con el mouse)
    const vp = car.querySelector('.ia-vp');
    vp.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    vp.addEventListener('pointerup', (e) => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 50) ir(i + (dx < 0 ? 1 : -1)); });
    vp.addEventListener('pointercancel', () => { x0 = null; });
    ir(0);
  }
  async function iniciar() {
    const car = document.getElementById('ia-car'), track = document.getElementById('ia-track'), st = document.getElementById('ia-estado');
    if (!car) return;
    let slides;
    try {
      const r = await fetch('data/impacto.json', { cache: 'no-cache' }); if (!r.ok) throw 0;
      const d = await r.json(), todas = (d.items || []).filter((i) => i && i.titulo && i.resumen && i.visible !== false);
      const f = todas.find((i) => i.id === d.destacado);
      const items = (f ? [f, ...todas.filter((i) => i !== f)] : todas).slice(0, MAX_NOTICIAS);   // la destacada va primero
      if (!items.length) throw 0;
      slides = items.map((it, n) => tarjeta(it, n + 1, items.length));
      track.append(...slides); car.hidden = false; carrusel(car, slides);
    } catch { st.textContent = 'No se pudo cargar el contenido de esta sección en este momento.'; return; }
    if (!('IntersectionObserver' in window)) { slides.forEach((c) => c.classList.add('vis')); return; }
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { slides.forEach((c) => c.classList.add('vis')); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(car);
  }
  document.addEventListener('DOMContentLoaded', iniciar);
})();
