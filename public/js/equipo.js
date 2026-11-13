/* Sección "Equipo de diseño": lee data/equipo.json (único lugar para editar perfiles). Pinta con textContent; no hay HTML de terceros. */
(function () {
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  const iniciales = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  async function iniciar() {
    const cont = document.getElementById('eq-perfiles'); if (!cont) return;
    try {
      const r = await fetch('data/equipo.json', { cache: 'no-cache' }); if (!r.ok) throw 0; const d = await r.json();
      const intro = document.getElementById('eq-intro'); if (d.intro) intro.textContent = d.intro;
      (d.miembros || []).filter((m) => m && m.name).forEach((m) => {
        const c = el('article', 'eq-c'), av = el('div', 'eq-av'); av.setAttribute('role', 'img'); av.setAttribute('aria-label', 'Avatar de ' + m.name);
        if (m.image) { const i = el('img'); i.src = m.image; i.alt = ''; i.loading = 'lazy'; i.onerror = () => { i.remove(); av.textContent = iniciales(m.name); }; av.append(i); } else av.textContent = iniciales(m.name);
        const b = el('div', 'eq-b'); b.append(el('h3', '', m.name)); if (m.role) b.append(el('p', 'eq-rol', m.role));
        if (m.roles_extra && m.roles_extra.length) { const t = el('div', 'eq-tags'); m.roles_extra.forEach((x) => t.append(el('span', 'eq-tag', x))); b.append(t); }
        if (m.afiliacion) b.append(el('p', 'eq-af', m.afiliacion)); if (m.bio) b.append(el('p', 'eq-bio', m.bio));
        c.append(av, b); cont.append(c);
      });
      const col = document.getElementById('eq-colab'); (d.colaboracion || []).forEach((a, i) => { const li = el('li', 'eq-n'); li.append(el('b', '', a.titulo), el('span', '', a.detalle), el('small', '', a.etapas || '')); col.append(li); });
    } catch { document.getElementById('eq-intro').textContent = 'No se pudo cargar esta sección en este momento.'; }
  }
  document.addEventListener('DOMContentLoaded', iniciar);
})();
