/* Vive el sistema Enjambre — experiencia interactiva. JavaScript + SVG + Canvas, sin dependencias ni servicios externos.
   El estado (S) es la única fuente de verdad: los contadores, el progreso y las escenas se derivan de él, de modo que
   cambiar de etapa, retroceder o reiniciar nunca duplica residuos, contadores ni eventos.
   Los textos de cada etapa siguen el concepto ilustrado del proyecto (assets/exp/etapa-*.webp). */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const mq = matchMedia('(prefers-reduced-motion: reduce)'), rm = () => mq.matches;
  const W = 800, H = 450, GOAL = 8, ALCANCE = 56;
  if (window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect) {   // navegadores antiguos (Safari < 16)
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
  }

  // ---- datos ------------------------------------------------------------------------------------------------------
  const TIPOS = {
    botella:   { n: 'Botella de plástico', cat: 'apto' },
    envase:    { n: 'Envase de plástico', cat: 'apto' },
    bolsa:     { n: 'Bolsa de plástico', cat: 'apto' },
    fragmento: { n: 'Fragmento de plástico', cat: 'apto' },
    rama:      { n: 'Rama o vegetación', cat: 'apto' },
    lata:      { n: 'Lata (metal)', cat: 'metal' },
    llanta:    { n: 'Llanta', cat: 'otro' },
    roca:      { n: 'Roca', cat: 'roca' },
  };
  const CATS = { apto: 'Aptos para trituración', metal: 'Metales', roca: 'Rocas', otro: 'Otros no deseados' };
  const PISTA = {
    apto: 'Los plásticos y la vegetación pueden pasar a la trituradora.',
    metal: 'Los metales pueden dañar la trituradora: el equipo los retira a mano.',
    roca: 'Las rocas pueden dañar la trituradora: el equipo las retira a mano.',
    otro: 'Es un material no deseado para la trituradora: se retira a mano (ilustrativo).',
  };
  const RES0 = [['botella', 250, 90], ['botella', 560, 150], ['botella', 380, 360], ['botella', 690, 320], ['envase', 330, 200], ['envase', 620, 60],
    ['bolsa', 470, 260], ['bolsa', 700, 170], ['fragmento', 200, 330], ['fragmento', 540, 390], ['rama', 430, 110], ['rama', 300, 410],
    ['lata', 650, 250], ['lata', 170, 140], ['llanta', 580, 330]];
  const ETAPAS = [
    { c: 'Transporte', t: 'Transporte de llegada', p: 'El sistema se transporta por vía terrestre y se instala cerca del cuerpo de agua. Su estructura integra los equipos y puede plegarse para guardarse y movilizarse en camión: por eso puede llegar a distintos ríos, lagos y canales.', i: 'Pulsa «Iniciar traslado» y observa cómo llega el equipo al sitio.' },
    { c: 'Despliegue', t: 'Despliegue e instalación', p: 'Antes de operar se posiciona la plataforma junto a la orilla, se prepara el barco recolector (que se opera a control remoto, sin persona a bordo), se activa el sistema y comienzan las operaciones. Es una representación ilustrativa.', i: 'Ejecuta las cuatro acciones en orden.' },
    { c: 'Navegación', t: 'Navegación del barco a control remoto', p: 'El barco recolector se opera a control remoto: navega y dirige los residuos flotantes hacia el extractor de la plataforma.', i: 'Pulsa «Iniciar navegación» y desplázate hacia los residuos: flechas o WASD, los botones de dirección o toca el agua.' },
    { c: 'Recolección', t: 'Recolección de residuos flotantes', p: 'El barco dirige los residuos hacia el extractor de cangilones, que los levanta y los lleva al sistema de procesamiento. Aquí, cada vez que estás cerca de un residuo y pulsas «Dirigir a la banda», este viaja hacia la plataforma.', i: 'Acércate a un residuo y pulsa «Dirigir a la banda» (o Espacio).' },
    { c: 'Separación', t: 'Banda transportadora y separación manual', p: 'Los residuos se trasladan por una banda transportadora para su revisión y separación inicial. El equipo retira manualmente metales, rocas y otros materiales que puedan dañar la trituradora; lo demás sigue a la trituración.', i: 'Elige un material y luego su destino (o arrástralo al destino).' },
    { c: 'Trituración', t: 'Trituración', p: 'Los residuos aptos pasan a la trituradora, donde se reducen de tamaño para facilitar su almacenamiento y manejo posterior. No todos los materiales se trituran, y triturar no equivale a reciclar.', i: 'Pulsa «Activar trituradora».' },
    { c: 'Almacenamiento', t: 'Contención del material triturado', p: 'El material triturado se almacena en contenedores o sacos para su transporte y gestión posterior; los materiales retirados a mano se concentran aparte. Los niveles son ilustrativos: aún no hay dimensiones definitivas.', i: 'Revisa los niveles y pulsa «Preparar para el retiro».' },
    { c: 'Salida', t: 'Transporte de salida y disposición', p: 'El material recolectado y procesado se retira del sitio para su transporte a un centro de acopio o gestor autorizado, según el tipo de residuo. El destino final depende del material y de los procesos de gestión disponibles.', i: 'Pulsa «Enviar al centro de acopio».' },
  ];

  // ---- estado ------------------------------------------------------------------------------------------------------
  const nuevo = () => ({
    etapa: 0, max: 0, pausa: false, e1: 0, e2: 0, nav: false, cerca: false,
    b: { x: 130, y: 225, a: 0, vx: 0, vy: 0 }, dest: null,
    res: RES0.map(([tipo, x, y], i) => ({ id: 'r' + i, tipo, x, y, estado: 'flota', g: 0, ph: i * 1.7 })),
    rec: [], extra: [], extras: false, sel: null, clas: {}, tri: [], trit: false, listo: false, salio: false,
  });
  let S = nuevo(), ES = { tipo: '', raf: 0, last: 0, keys: new Set(), pad: new Set(), fx: [], off: [] }, VIS = true;
  const todos = () => S.rec.concat(S.extra);
  const pendientes = () => todos().filter((o) => !S.clas[o.id]);
  const aptos = () => todos().filter((o) => S.clas[o.id] === 'apto');
  const hecha = (i) => [S.e1 === 2, S.e2 === 4, S.cerca, S.rec.length >= GOAL, S.extras && todos().length > 0 && pendientes().length === 0,
    S.extras && aptos().length > 0 && S.tri.length >= aptos().length && pendientes().length === 0, S.listo, S.salio][i];

  // ---- utilidades ---------------------------------------------------------------------------------------------------
  const h = (t, a = {}, ...k) => { const e = document.createElement(t); for (const n in a) { if (n === 'on') for (const ev in a.on) e.addEventListener(ev, a.on[ev]); else if (n in e && n !== 'list') e[n] = a[n]; else e.setAttribute(n, a[n]); } e.append(...k.flat().filter((x) => x != null)); return e; };
  const say = (t) => { const el = $('#instr'); if (el.textContent !== t) el.textContent = t; };
  const lis = (t, f, o) => { document.addEventListener(t, f, o); ES.off.push(() => document.removeEventListener(t, f, o)); };
  const ICONO = {   // iconos distintos por FORMA (no solo por color)
    botella: '<rect x="11" y="9" width="8" height="18" rx="3" fill="#8fd3f0" stroke="#fff" stroke-width="1.5"/><rect x="12.5" y="4" width="5" height="5" fill="#fff"/>',
    envase: '<rect x="4" y="10" width="22" height="14" rx="2" fill="#e8e8e8" stroke="#fff" stroke-width="1.5"/><path d="M4 14h22" stroke="#888"/>',
    bolsa: '<path d="M8 6h14l3 20H5z" fill="#f4f4f4" stroke="#aaa" stroke-width="1.5"/><path d="M11 6c0-4 8-4 8 0" fill="none" stroke="#aaa" stroke-width="1.5"/>',
    fragmento: '<path d="M5 22 9 7l8 4 9 3-4 11z" fill="#e24a4a" stroke="#fff" stroke-width="1.5"/>',
    rama: '<path d="M4 25 24 6M14 15l-1-8M19 11l7 1" stroke="#b07a3c" stroke-width="3" stroke-linecap="round" fill="none"/><ellipse cx="9" cy="10" rx="4" ry="2.5" fill="#4caf50" transform="rotate(-30 9 10)"/>',
    lata: '<rect x="8" y="8" width="14" height="18" rx="2" fill="#c0392b" stroke="#fff" stroke-width="1.5"/><ellipse cx="15" cy="8" rx="7" ry="2.5" fill="#ddd" stroke="#fff"/>',
    llanta: '<circle cx="15" cy="15" r="9" fill="none" stroke="#222" stroke-width="6"/><circle cx="15" cy="15" r="11.5" fill="none" stroke="#fff" stroke-width="1"/>',
    roca: '<path d="M4 22l4-12 8-4 9 7 2 9z" fill="#8c8c8c" stroke="#fff" stroke-width="1.5"/>',
  };
  const svgIcon = (t) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 30 30'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = ICONO[t]; return s; };  // SVG estático propio
  const scene = () => $('#escena');
  const anims = () => scene().getAnimations({ subtree: true });

  // ---- encabezado, progreso y botones -------------------------------------------------------------------------------
  function render() {
    const e = ETAPAS[S.etapa], n = S.etapa + 1;
    $('#et-n').textContent = n + '/8'; $('#et-t').textContent = e.t; $('#et-p').textContent = e.p;
    $('#ref-img').src = `../assets/exp/etapa-${n}.webp`; $('#ref-img').alt = `Ilustración conceptual del proyecto para la etapa ${n}: ${e.t}.`;
    $('#ref-cap').textContent = `Concepto ilustrado del proyecto · etapa ${n}`;
    say(e.i); chips(); estado(); desmontar(); montar();
  }
  function chips() {
    const ol = $('#chips'); ol.replaceChildren(...ETAPAS.map((e, i) => h('li', {}, h('button', {
      type: 'button', className: hecha(i) ? 'hecha' : '', disabled: i > S.max, 'aria-current': i === S.etapa ? 'step' : null,
      'aria-label': `Etapa ${i + 1}: ${e.c}${hecha(i) ? ' (completada)' : ''}`, on: { click: () => ir(i) },
    }, `${i + 1}. ${e.c}`))));
  }
  function estado() {   // contadores, progreso y botones: todo derivado del estado
    $('#c-rec').textContent = S.rec.length; $('#c-cla').textContent = Object.keys(S.clas).length + '/' + (S.extras ? todos().length : S.rec.length);
    $('#c-tri').textContent = S.tri.length + '/' + (S.extras ? aptos().length : 0);
    const done = ETAPAS.filter((_, i) => hecha(i)).length, b = $('#bar'); b.setAttribute('aria-valuenow', Math.round(done / 8 * 100)); b.firstElementChild.style.width = done / 8 * 100 + '%';
    $('#b-atras').disabled = S.etapa === 0; const sig = $('#b-sig'), fin = S.etapa === 7;
    sig.disabled = fin || !hecha(S.etapa); sig.textContent = fin ? (S.salio ? 'Recorrido completo ✓' : 'Última etapa') : 'Continuar →';
    document.querySelectorAll('#chips button').forEach((c, i) => { c.disabled = i > S.max; });
  }
  function ir(i) { if (i < 0 || i > 7 || i > S.max) return; S.etapa = i; render(); scene().scrollIntoView({ block: 'nearest', behavior: rm() ? 'auto' : 'smooth' }); }
  $('#b-atras').onclick = () => ir(S.etapa - 1);
  $('#b-sig').onclick = () => { if (hecha(S.etapa) && S.etapa < 7) { S.max = Math.max(S.max, S.etapa + 1); ir(S.etapa + 1); } };
  $('#b-pausa').onclick = () => { S.pausa = !S.pausa; const b = $('#b-pausa'); b.setAttribute('aria-pressed', S.pausa); b.textContent = S.pausa ? 'Reanudar' : 'Pausar'; document.body.classList.toggle('pausa', S.pausa); sync(); if (ES.tipo === 'mar') dibuja(performance.now()); say(S.pausa ? 'Experiencia en pausa.' : ETAPAS[S.etapa].i); };
  $('#b-reinicio').onclick = () => { desmontar(); S = nuevo(); document.body.classList.remove('pausa'); $('#b-pausa').setAttribute('aria-pressed', 'false'); $('#b-pausa').textContent = 'Pausar'; render(); say('Recorrido reiniciado. ' + ETAPAS[0].i); };

  // ---- ciclo de vida de las escenas ----------------------------------------------------------------------------------
  function desmontar() {
    cancelAnimationFrame(ES.raf); clearInterval(ES.timer); ES.off.forEach((f) => f()); anims().forEach((a) => a.cancel());
    ES = { tipo: '', raf: 0, last: 0, keys: new Set(), pad: new Set(), fx: [], off: [] }; S.nav = false; S.trit = false; S.dest = null; S.sel = null; scene().replaceChildren();
  }
  function montar() { [e1, e2, mar, mar, separa, tritura, almacen, salida][S.etapa](); sync(); }
  const activo = () => ES.tipo === 'mar' && !S.pausa && VIS && !document.hidden;
  function sync() {
    const run = !S.pausa && VIS && !document.hidden; anims().forEach((a) => (run ? a.play() : a.pause()));
    if (ES.tipo === 'mar') { if (activo()) arrancar(); else cancelAnimationFrame(ES.raf), (ES.raf = 0); }
  }
  new IntersectionObserver((es) => { VIS = es[0].isIntersecting; sync(); }, { threshold: 0.1 }).observe(scene());
  document.addEventListener('visibilitychange', sync);

  // ---- escenas SVG (etapas 1, 2, 6, 7, 8) ---------------------------------------------------------------------------
  const SVG = (inner, label) => { const d = document.createElement('div'); d.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${inner}</svg>`; return d.firstChild; };  // contenido estático propio
  const FONDO = '<rect width="800" height="450" fill="#0e3a52"/><rect y="300" width="800" height="150" fill="#16303b"/>';
  const CAMION = (x) => `<g id="camion" style="transform:translateX(${x}px)"><rect x="40" y="215" width="150" height="85" rx="4" fill="#cfd8dc" stroke="#fff" stroke-width="2"/><rect x="60" y="225" width="90" height="40" fill="#f2b705" opacity=".85"/><path d="M190 240h38l16 24v36h-54z" fill="#fff" stroke="#9db2ba" stroke-width="2"/><rect x="200" y="248" width="26" height="18" fill="#7ec8e3"/><circle cx="80" cy="304" r="17" fill="#111" stroke="#9db2ba" stroke-width="3"/><circle cx="205" cy="304" r="17" fill="#111" stroke="#9db2ba" stroke-width="3"/></g>`;
  const fila = (...k) => h('div', { className: 'fila' }, ...k);
  const btn = (txt, fn, cls = 'p', extra = {}) => h('button', { type: 'button', className: 'btn ' + cls, on: { click: fn }, ...extra }, txt);

  function e1() {   // transporte de llegada
    ES.tipo = 'svg'; const sv = SVG(FONDO + '<rect x="560" y="300" width="240" height="150" fill="#1fa6cf"/><rect x="560" y="300" width="240" height="8" fill="#8fe3f7" opacity=".5"/><path d="M0 330h560" stroke="#2c4651" stroke-width="40"/><path d="M0 330h560" stroke="#8aa0a8" stroke-width="3" stroke-dasharray="22 16"/>'
      + '<rect x="440" y="210" width="130" height="100" rx="4" fill="none" stroke="#f2b705" stroke-width="3" stroke-dasharray="8 6" id="sitio" opacity="0"/><text x="505" y="200" fill="#f2b705" font-size="16" text-anchor="middle" id="sitio-t" opacity="0">Sitio de operación</text>'
      + CAMION(S.e1 === 2 ? 300 : -200), 'Un camión transporta la plataforma Enjambre por carretera hasta el cuerpo de agua.');
    const go = btn(S.e1 === 0 ? 'Iniciar traslado' : 'Traslado completado ✓', () => {
      if (S.e1 !== 0) return; S.e1 = 1; go.disabled = true; go.textContent = 'En camino…'; say('El camión transporta la plataforma por vía terrestre…');
      const fin = () => { S.e1 = 2; fijaE1(); go.textContent = 'Traslado completado ✓'; say('Llegada al sitio: el equipo queda listo para su despliegue. Puedes continuar.'); estado(); chips(); };
      if (rm()) { $('#camion', sv).style.transform = 'translateX(300px)'; fin(); return; }
      const a = $('#camion', sv).animate([{ transform: 'translateX(-200px)' }, { transform: 'translateX(300px)' }], { duration: 4000, easing: 'ease-in-out', fill: 'forwards' });
      a.onfinish = () => { $('#camion', sv).style.transform = 'translateX(300px)'; fin(); }; sync();
    }, 'p', { disabled: S.e1 !== 0 });
    const fijaE1 = () => { $('#sitio', sv).setAttribute('opacity', 1); $('#sitio-t', sv).setAttribute('opacity', 1); };
    if (S.e1 === 2) { fijaE1(); say('Llegada al sitio: el equipo queda listo para su despliegue. Puedes continuar.'); }
    scene().append(sv, fila(go, h('span', { className: 'pos' }, 'Transportable y adaptable: llega a distintos cuerpos de agua.')));
  }

  const PASOS2 = ['Posicionar la plataforma junto a la orilla', 'Preparar el barco recolector (control remoto)', 'Activar el sistema', 'Iniciar las operaciones de recolección'];
  function e2() {   // despliegue e instalación
    ES.tipo = 'svg'; const op = (n) => (S.e2 >= n ? 1 : 0);
    const sv = SVG(FONDO.replace('#16303b', '#16303b') + '<rect x="470" y="250" width="330" height="200" fill="#1fa6cf"/><rect x="470" y="250" width="330" height="8" fill="#8fe3f7" opacity=".5"/>'
      + '<g><rect x="90" y="190" width="170" height="110" rx="4" fill="#cfd8dc" stroke="#fff" stroke-width="2"/><rect x="105" y="205" width="60" height="50" fill="#f2b705" opacity=".85"/><circle id="luz" cx="230" cy="205" r="9" fill="' + (op(3) ? '#4cd964' : '#777') + '" stroke="#fff" stroke-width="2"/><text x="175" y="180" fill="#fff" font-size="14" text-anchor="middle">Plataforma</text></g>'
      + `<g id="rampa" style="transition:opacity .7s;opacity:${op(1)}"><path d="M260 240 480 330" stroke="#8aa0a8" stroke-width="30"/><path d="M260 240 480 330" stroke="#f2b705" stroke-width="4" stroke-dasharray="10 8"/></g>`
      + `<g id="barco2" style="transition:opacity .7s,transform .9s;opacity:${op(2)};transform:translate(${op(4) ? 90 : 0}px,${op(4) ? -50 : 0}px)"><rect x="560" y="330" width="90" height="30" rx="8" fill="#1b1f24" stroke="#6b7b84" stroke-width="2"/><rect x="570" y="312" width="26" height="30" rx="4" fill="#d63a3a"/><rect x="614" y="312" width="26" height="30" rx="4" fill="#d63a3a"/><circle cx="605" cy="326" r="5" fill="#4cd964"/></g>`
      + `<text id="t4" x="640" y="270" fill="#f2b705" font-size="15" text-anchor="middle" style="opacity:${op(4)}">Dirige los residuos hacia la banda</text>`, 'Se posiciona la plataforma, se prepara el barco a control remoto, se activa el sistema y empiezan las operaciones.');
    const ol = h('ol', { className: 'resumen', 'aria-label': 'Acciones de despliegue' }); const pintaOl = () => ol.replaceChildren(...PASOS2.map((p, i) => h('li', { 'aria-current': i === S.e2 ? 'step' : null }, (S.e2 > i ? '✓ ' : (i + 1) + '. ') + p)));
    const go = btn('', () => {
      if (S.e2 >= 4) return; S.e2++; const q = (id) => $('#' + id, sv);
      if (S.e2 === 1) q('rampa').style.opacity = 1; if (S.e2 === 2) q('barco2').style.opacity = 1; if (S.e2 === 3) q('luz').setAttribute('fill', '#4cd964');
      if (S.e2 === 4) { q('barco2').style.transform = 'translate(90px,-50px)'; q('t4').style.opacity = 1; }
      etq(); pintaOl(); estado(); chips(); say(S.e2 === 4 ? 'Operaciones iniciadas. Puedes continuar.' : 'Listo. Sigue con la siguiente acción.');
    });
    const etq = () => { go.disabled = S.e2 >= 4; go.textContent = S.e2 >= 4 ? 'Despliegue completo ✓' : `Acción ${S.e2 + 1}: ${PASOS2[S.e2]}`; };
    etq(); pintaOl(); scene().append(sv, fila(go), ol);
  }

  // ---- escena de navegación y recolección (etapas 3 y 4) ---------------------------------------------------------------
  function mar() {
    ES.tipo = 'mar'; const k = Math.min(2, window.devicePixelRatio || 1), cv = h('canvas', { width: W * k, height: H * k, tabIndex: 0, role: 'group', 'aria-label': 'Escenario acuático. Usa las flechas o WASD para mover el barco; Espacio dirige el residuo cercano hacia la banda. También puedes tocar el agua.' });
    const c = cv.getContext('2d'); c.scale(k, k); ES.cv = cv; ES.c = c;
    const pos = h('output', { className: 'pos', 'aria-label': 'Zona actual' }), est4 = S.etapa === 3;
    const nav = btn('Iniciar navegación', () => { S.nav = !S.nav; if (!S.nav) S.dest = null; pinta(); if (S.nav) { say(est4 ? 'Navegación activa. Acércate a un residuo y pulsa «Dirigir a la banda».' : 'Navegación activa. Desplázate hacia los residuos.'); arrancar(); } else say('Navegación detenida.'); }, 's', { 'aria-pressed': 'false' });
    const pinta = () => { nav.textContent = S.nav ? 'Detener navegación' : 'Iniciar navegación'; nav.setAttribute('aria-pressed', S.nav); };
    const dir = (cls, lab, sym) => { const b = h('button', { type: 'button', className: cls, 'aria-label': lab }, sym), on = () => { if (!S.nav) { S.nav = true; pinta(); } ES.pad.add(cls); arrancar(); }, off = () => ES.pad.delete(cls);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => b.addEventListener(t, off));
      b.addEventListener('click', (e) => { if (e.detail === 0) { const v = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[cls]; S.nav = true; pinta(); S.b.x += v[0] * 30; S.b.y += v[1] * 30; limita(); cerca(); dibuja(performance.now()); } }); return b; };
    const pad = h('div', { className: 'pad', role: 'group', 'aria-label': 'Controles de dirección' }, dir('n', 'Mover hacia arriba', '▲'), dir('w', 'Mover hacia la izquierda', '◀'), dir('s', 'Mover hacia abajo', '▼'), dir('e', 'Mover hacia la derecha', '▶'));
    const rec = btn('Dirigir a la banda', recoge, 'p', { 'aria-label': 'Dirigir el residuo más cercano hacia el extractor', hidden: !est4 });
    pinta(); scene().append(cv, fila(nav, pad, rec, pos));
    ES.pos = pos; ES.nav = nav;
    cv.addEventListener('click', (e) => { const r = cv.getBoundingClientRect(); S.dest = { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; if (!S.nav) { S.nav = true; pinta(); } arrancar(); });
    const M = { ArrowUp: 'n', w: 'n', W: 'n', ArrowDown: 's', s: 's', S: 's', ArrowLeft: 'w', a: 'w', A: 'w', ArrowRight: 'e', d: 'e', D: 'e' };
    const escribe = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey;
    lis('keydown', (e) => { if (escribe(e) || S.pausa || !VIS) return; if (M[e.key] && S.nav) { e.preventDefault(); ES.keys.add(M[e.key]); arrancar(); }
      else if (e.code === 'Space' && est4 && S.nav && !/BUTTON|A/.test(e.target.tagName)) { e.preventDefault(); recoge(); } });
    lis('keyup', (e) => { if (M[e.key]) ES.keys.delete(M[e.key]); });
    if (rm()) pos.textContent = ''; if (S.cerca && !est4) say('¡Estás cerca de un residuo! Puedes continuar a la recolección.');
    cerca(); dibuja(performance.now()); sync();
  }
  const limita = () => { S.b.x = Math.max(30, Math.min(W - 24, S.b.x)); S.b.y = Math.max(24, Math.min(H - 24, S.b.y)); };
  const flota = () => S.res.filter((r) => r.estado === 'flota');
  function cercano() { let m = null, d = 1e9; for (const r of flota()) { const q = Math.hypot(r.x - S.b.x, r.y - S.b.y); if (q < d) { d = q; m = r; } } return { r: m, d }; }
  function cerca() {
    const { r, d } = cercano(); ES.cercaId = r && d <= ALCANCE ? r.id : null; ES.pos && (ES.pos.textContent = `Zona ${'ABCD'[Math.min(3, Math.floor(S.b.x / 200))]}${Math.min(3, Math.floor(S.b.y / 150) + 1)}`);
    if (ES.cercaId && !S.cerca) { S.cerca = true; say(S.etapa === 2 ? '¡Estás cerca de un residuo! Pulsa «Continuar» para empezar a recolectar.' : '¡A tu alcance! Pulsa «Dirigir a la banda».'); estado(); chips(); }
  }
  function recoge() {
    if (S.etapa !== 3) return; cerca(); const r = S.res.find((x) => x.id === ES.cercaId);
    if (!r) { say(flota().length ? 'Acércate más a un residuo para dirigirlo a la banda.' : 'No quedan residuos flotando en el escenario.'); return; }
    r.estado = rm() ? 'fin' : 'glide'; S.rec.push({ id: r.id, tipo: r.tipo });   // se cuenta una sola vez: el id pasa a «glide»/«fin» y deja de ser elegible
    if (!rm()) ES.fx.push({ x: r.x, y: r.y, t: 0 }); estado(); chips(); arrancar();
    const n = S.rec.length; say(n >= GOAL ? `¡Objetivo cumplido! ${n} residuos dirigidos a la banda. Puedes seguir o continuar.` : `${TIPOS[r.tipo].n} dirigido a la banda (${n}/${GOAL}).`); cerca();
  }
  function arrancar() { if (ES.raf || !activo()) return; ES.last = performance.now(); ES.raf = requestAnimationFrame(tick); }
  function tick(t) {
    ES.raf = 0; if (!activo()) return; const dt = Math.min(0.05, (t - ES.last) / 1000 || 0); ES.last = t;
    const b = S.b, d = new Set([...ES.keys, ...ES.pad]); let tx = 0, ty = 0, mueve = false;
    if (S.nav) { if (d.has('n')) ty -= 1; if (d.has('s')) ty += 1; if (d.has('w')) tx -= 1; if (d.has('e')) tx += 1;
      if (tx || ty) { S.dest = null; mueve = true; } else if (S.dest) { const dx = S.dest.x - b.x, dy = S.dest.y - b.y, q = Math.hypot(dx, dy); if (q < 8) S.dest = null; else { tx = dx / q; ty = dy / q; mueve = true; } }
      const q = Math.hypot(tx, ty) || 1; tx /= q; ty /= q; }
    b.vx += (tx * 150 - b.vx) * Math.min(1, dt * 6); b.vy += (ty * 150 - b.vy) * Math.min(1, dt * 6); b.x += b.vx * dt; b.y += b.vy * dt; limita();
    if (Math.hypot(b.vx, b.vy) > 8) b.a = Math.atan2(b.vy, b.vx);
    for (const r of S.res) if (r.estado === 'glide') { r.g += dt / 0.6; if (r.g >= 1) r.estado = 'fin'; }
    ES.fx = ES.fx.filter((f) => (f.t += dt) < 0.9); cerca(); dibuja(t);
    const anima = mueve || Math.hypot(b.vx, b.vy) > 8 || ES.fx.length || S.res.some((r) => r.estado === 'glide') || !rm();
    if (anima && activo()) ES.raf = requestAnimationFrame(tick);
  }
  function dibuja(t) {
    const c = ES.c; if (!c) return; const mov = !rm();
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0f5373'); g.addColorStop(1, '#0a3248'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(143,227,247,.12)'; c.lineWidth = 1; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(i * 200, 0); c.lineTo(i * 200, H); c.stroke(); } for (let j = 1; j < 3; j++) { c.beginPath(); c.moveTo(0, j * 150); c.lineTo(W, j * 150); c.stroke(); }
    if (mov) { c.strokeStyle = 'rgba(143,227,247,.18)'; for (let y = 40; y < H; y += 60) { c.beginPath(); for (let x = 0; x <= W; x += 20) c.lineTo(x, y + Math.sin(x / 40 + t / 700 + y) * 3); c.stroke(); } }
    c.setLineDash([8, 6]); c.strokeStyle = 'rgba(242,183,5,.55)'; c.strokeRect(76, 12, W - 88, H - 24); c.setLineDash([]); c.fillStyle = 'rgba(242,183,5,.8)'; c.font = '13px system-ui'; c.fillText('Zona de operación', 86, 30);
    c.fillStyle = '#2c3d45'; c.fillRect(0, 130, 62, 190); c.fillStyle = '#f2b705'; c.fillRect(0, 130, 5, 190); c.fillRect(57, 130, 5, 190);   // plataforma con el extractor
    c.fillStyle = '#8aa0a8'; for (let y = 140; y < 310; y += 16) c.fillRect(10, y, 42, 6); c.fillStyle = '#fff'; c.font = '12px system-ui'; c.fillText('Extractor', 4, 126);
    for (const r of S.res) {
      if (r.estado === 'fin') continue; let x = r.x, y = r.y + (mov && r.estado === 'flota' ? Math.sin(t / 600 + r.ph) * 2.5 : 0), s = 1;
      if (r.estado === 'glide') { const e = r.g * r.g; x = r.x + (36 - r.x) * e; y = r.y + (225 - r.y) * e; s = 1 - 0.4 * e; }
      c.save(); c.translate(x, y); c.scale(s * 1.15, s * 1.15); c.translate(-15, -15); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(15, 28, 11, 3, 0, 0, 7); c.fill();
      dibujaTipo(c, r.tipo); c.restore();
      if (r.id === ES.cercaId && r.estado === 'flota') { c.setLineDash([4, 3]); c.strokeStyle = '#f2b705'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 24, 0, 7); c.stroke(); c.setLineDash([]); c.fillStyle = '#f2b705'; c.font = 'bold 12px system-ui'; c.textAlign = 'center'; c.fillText('A tu alcance', x, y - 30); c.textAlign = 'left'; }
    }
    const b = S.b; c.save(); c.translate(b.x, b.y); c.rotate(b.a); c.fillStyle = '#1b1f24'; c.strokeStyle = '#9db2ba'; c.lineWidth = 2; c.beginPath(); c.roundRect(-30, -15, 60, 30, 7); c.fill(); c.stroke();
    c.fillStyle = '#d63a3a'; c.strokeStyle = '#fff'; c.lineWidth = 1.5; for (const x of [-22, 11]) { c.beginPath(); c.roundRect(x, -19, 11, 38, 3); c.fill(); c.stroke(); }
    c.fillStyle = '#4cd964'; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(36, 0); c.lineTo(28, -6); c.lineTo(28, 6); c.fill(); c.restore();
    if (S.dest && S.nav) { c.strokeStyle = '#8fe3f7'; c.lineWidth = 2; c.beginPath(); c.arc(S.dest.x, S.dest.y, 9, 0, 7); c.stroke(); }
    c.fillStyle = '#4cd964'; c.font = 'bold 16px system-ui'; for (const f of ES.fx) { c.globalAlpha = 1 - f.t / 0.9; c.fillText('+1', f.x - 8, f.y - 28 - f.t * 30); } c.globalAlpha = 1;
    if (S.pausa) { c.fillStyle = 'rgba(10,34,48,.6)'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.font = '28px system-ui'; c.textAlign = 'center'; c.fillText('En pausa', W / 2, H / 2); c.textAlign = 'left'; }
  }
  function dibujaTipo(c, t) {
    c.lineWidth = 1.5; c.strokeStyle = '#fff';
    if (t === 'botella') { c.fillStyle = '#8fd3f0'; c.beginPath(); c.roundRect(11, 9, 8, 18, 3); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.fillRect(12.5, 4, 5, 5); }
    else if (t === 'envase') { c.fillStyle = '#e8e8e8'; c.beginPath(); c.roundRect(4, 10, 22, 14, 2); c.fill(); c.stroke(); c.strokeStyle = '#888'; c.beginPath(); c.moveTo(4, 14); c.lineTo(26, 14); c.stroke(); }
    else if (t === 'bolsa') { c.fillStyle = '#f4f4f4'; c.strokeStyle = '#aaa'; c.beginPath(); c.moveTo(8, 6); c.lineTo(22, 6); c.lineTo(25, 26); c.lineTo(5, 26); c.closePath(); c.fill(); c.stroke(); }
    else if (t === 'fragmento') { c.fillStyle = '#e24a4a'; c.beginPath(); c.moveTo(5, 22); c.lineTo(9, 7); c.lineTo(17, 11); c.lineTo(26, 14); c.lineTo(22, 25); c.closePath(); c.fill(); c.stroke(); }
    else if (t === 'rama') { c.strokeStyle = '#b07a3c'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(4, 25); c.lineTo(24, 6); c.moveTo(14, 15); c.lineTo(13, 7); c.stroke(); c.fillStyle = '#4caf50'; c.beginPath(); c.ellipse(9, 10, 4, 2.5, -0.5, 0, 7); c.fill(); }
    else if (t === 'lata') { c.fillStyle = '#c0392b'; c.beginPath(); c.roundRect(8, 8, 14, 18, 2); c.fill(); c.stroke(); c.fillStyle = '#ddd'; c.beginPath(); c.ellipse(15, 8, 7, 2.5, 0, 0, 7); c.fill(); c.stroke(); }
    else if (t === 'llanta') { c.strokeStyle = '#222'; c.lineWidth = 6; c.beginPath(); c.arc(15, 15, 9, 0, 7); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.arc(15, 15, 11.5, 0, 7); c.stroke(); }
  }

  // ---- etapa 5: separación ---------------------------------------------------------------------------------------------
  function separa() {
    ES.tipo = 'dom';
    if (!S.extras) { S.extra = [{ id: 'x1', tipo: 'roca' }]; S.extras = true; estado(); say('La banda también trae una roca arrastrada. ' + ETAPAS[4].i); }
    const lista = h('div', { className: 'lista', role: 'group', 'aria-label': 'Materiales pendientes de clasificar' }), bins = h('div', { className: 'bins', role: 'group', 'aria-label': 'Destinos' });
    const pinta = () => {
      lista.replaceChildren(...(pendientes().length ? pendientes().map((o) => { const b = h('button', { type: 'button', className: 'item', draggable: true, 'aria-pressed': S.sel === o.id, 'aria-label': `Seleccionar ${TIPOS[o.tipo].n}` }, svgIcon(o.tipo), TIPOS[o.tipo].n);
        b.addEventListener('click', () => { S.sel = S.sel === o.id ? null : o.id; pinta(); if (S.sel) say(`Elegiste «${TIPOS[o.tipo].n}». Ahora elige su destino.`); });
        b.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', o.id); S.sel = o.id; }); return b; })
        : [h('p', {}, '✓ Todo el material está clasificado.')]));
      bins.replaceChildren(...Object.keys(CATS).map((k) => { const n = todos().filter((o) => S.clas[o.id] === k).length, b = h('button', { type: 'button', className: 'bin', 'data-c': k, disabled: false, 'aria-label': S.sel ? `Clasificar «${TIPOS[todos().find((o) => o.id === S.sel).tipo].n}» como ${CATS[k]}` : `${CATS[k]}: ${n} clasificados` }, CATS[k], h('small', {}, n + ' clasificados'));
        b.addEventListener('click', () => clasifica(S.sel, k, b)); b.addEventListener('dragover', (e) => { e.preventDefault(); b.classList.add('sobre'); }); b.addEventListener('dragleave', () => b.classList.remove('sobre'));
        b.addEventListener('drop', (e) => { e.preventDefault(); b.classList.remove('sobre'); clasifica(e.dataTransfer.getData('text/plain'), k, b); }); return b; }));
    };
    function clasifica(id, k, b) {
      const o = todos().find((x) => x.id === id); if (!o || S.clas[id]) { say('Primero elige un material pendiente.'); return; }
      if (TIPOS[o.tipo].cat === k) { S.clas[id] = k; S.sel = null; pinta(); estado(); chips(); say(pendientes().length ? `Correcto: «${TIPOS[o.tipo].n}» va en «${CATS[k]}». Pendientes: ${pendientes().length}.` : 'Todo el material está clasificado. Puedes continuar a la trituración.'); }
      else { b.classList.remove('sacude'); void b.offsetWidth; b.classList.add('sacude'); say(`«${TIPOS[o.tipo].n}» no va en «${CATS[k]}». ${PISTA[TIPOS[o.tipo].cat]}`); }
    }
    pinta(); scene().append(h('div', { className: 'fila' }, h('span', { className: 'pos' }, 'En el concepto del proyecto, esta separación inicial la hace el equipo a mano sobre la banda.')), lista, bins);
  }

  // ---- etapa 6: trituración ---------------------------------------------------------------------------------------------
  const COL = ['#27b8dc', '#f2b705', '#e24a4a', '#4cd964', '#9b6bff', '#ffffff'];
  function tritura() {
    ES.tipo = 'dom'; const sv = SVG('<rect width="800" height="450" fill="#1d2a31"/><path d="M270 40h260l-40 90H310z" fill="#37505b" stroke="#9db2ba" stroke-width="3"/><text x="400" y="85" fill="#fff" font-size="15" text-anchor="middle">Entrada</text>'
      + '<rect x="230" y="130" width="340" height="150" rx="8" fill="#2c3d45" stroke="#9db2ba" stroke-width="3"/>'
      + [0, 1, 2, 3].map((i) => `<g class="${S.trit ? 'rot' : ''}" id="ro${i}"><circle cx="${290 + i * 73}" cy="205" r="30" fill="#59707b" stroke="#fff" stroke-width="3"/><path d="M${290 + i * 73} 175v60M${260 + i * 73} 205h60" stroke="#fff" stroke-width="5"/></g>`).join('')
      + '<path d="M270 280h260l30 40H240z" fill="#37505b"/><rect x="240" y="320" width="320" height="100" rx="6" fill="#16242b" stroke="#9db2ba" stroke-width="3"/><text x="400" y="438" fill="#fff" font-size="14" text-anchor="middle">Material triturado (ilustrativo)</text><g id="piezas"></g>'
      + '<rect x="610" y="150" width="150" height="70" rx="6" fill="#16242b" stroke="#d97979" stroke-width="2" stroke-dasharray="6 4"/><text x="685" y="180" fill="#fff" font-size="13" text-anchor="middle">Metales, rocas y otros</text><text x="685" y="200" fill="#9db2ba" font-size="12" text-anchor="middle">no se trituran</text>', 'Una trituradora reduce de tamaño los residuos aptos.');
    const pz = $('#piezas', sv), pinta = () => { pz.replaceChildren(); S.tri.forEach((_, i) => { const r = document.createElementNS('http://www.w3.org/2000/svg', 'g'); for (let j = 0; j < 5; j++) { const q = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); const n = i * 5 + j; q.setAttribute('x', 252 + (n * 37) % 290); q.setAttribute('y', 392 - Math.floor(n * 37 / 290) * 7 - (n % 3) * 3); q.setAttribute('width', 8); q.setAttribute('height', 6); q.setAttribute('fill', COL[n % COL.length]); r.append(q); } pz.append(r); }); };
    const info = h('span', { className: 'pos', role: 'status' }), pend = () => aptos().filter((o) => !S.tri.includes(o.id));
    const go = btn('', () => { if (!pend().length) return; S.trit = !S.trit; if (rm()) { S.tri = aptos().map((o) => o.id); S.trit = false; } etq(); marcha(); if (S.trit) say('Trituradora en marcha…'); });
    const etq = () => { go.disabled = !pend().length; go.textContent = !pend().length ? 'Trituración completa ✓' : S.trit ? 'Detener trituradora' : 'Activar trituradora'; info.textContent = `Procesados ${S.tri.length} · pendientes ${pend().length}`; };
    const marcha = () => { sv.querySelectorAll('[id^=ro]').forEach((g) => g.classList.toggle('rot', S.trit && !S.pausa)); pinta(); estado(); chips(); if (!pend().length) { S.trit = false; sv.querySelectorAll('[id^=ro]').forEach((g) => g.classList.remove('rot')); etq(); say('Trituración completa. Los residuos aptos redujeron su tamaño; el destino posterior depende de cada material. Puedes continuar.'); } };
    ES.timer = setInterval(() => { if (!S.trit || S.pausa || !VIS || document.hidden) return; const o = pend()[0]; if (o) { S.tri.push(o.id); say(`Entra a la trituradora: ${TIPOS[o.tipo].n}.`); } etq(); marcha(); }, 650);
    etq(); pinta(); marcha(); scene().append(sv, fila(go, info));
    if (!S.trit && !pend().length) say('Trituración completa. Puedes continuar.');
  }

  // ---- etapa 7: almacenamiento -----------------------------------------------------------------------------------------
  const conteo = (k) => todos().filter((o) => S.clas[o.id] === k).length;
  function almacen() {
    ES.tipo = 'dom'; const nv = (n, cap) => Math.round(Math.min(1, n / cap) * 120);
    const caja = (x, tit, n, cap, col) => `<g><rect x="${x}" y="150" width="120" height="130" rx="6" fill="#16242b" stroke="#9db2ba" stroke-width="2"/><rect x="${x}" y="${280 - nv(n, cap) - 6}" width="120" height="${nv(n, cap)}" fill="${col}" opacity=".85"/><text x="${x + 60}" y="305" fill="#fff" font-size="13" text-anchor="middle">${tit}</text><text x="${x + 60}" y="323" fill="#8fe3f7" font-size="13" text-anchor="middle">${n} piezas</text></g>`;
    const sv = SVG('<rect width="800" height="450" fill="#1d2a31"/>' + `<g><path d="M60 130h190l12 150H48z" fill="#e9eef0" stroke="#9db2ba" stroke-width="3"/><rect x="${48 + 6}" y="${280 - nv(S.tri.length, 12) - 4}" width="${200}" height="${nv(S.tri.length, 12)}" fill="#27b8dc" opacity=".8"/><text x="155" y="305" fill="#fff" font-size="13" text-anchor="middle">Saco: material triturado</text><text x="155" y="323" fill="#8fe3f7" font-size="13" text-anchor="middle">${S.tri.length} piezas</text><text id="sello" x="155" y="120" fill="#f2b705" font-size="15" text-anchor="middle" style="opacity:${S.listo ? 1 : 0}">Sellado para el retiro</text></g>`
      + caja(300, 'Metales', conteo('metal'), 6, '#d63a3a') + caja(440, 'Rocas', conteo('roca'), 6, '#8c8c8c') + caja(580, 'Otros no deseados', conteo('otro'), 6, '#b07a3c')
      + '<text x="400" y="400" fill="#9db2ba" font-size="13" text-anchor="middle">Niveles ilustrativos: las dimensiones y capacidades reales aún no están definidas.</text>', 'Compartimentos con el nivel de material triturado y de materiales retirados a mano.');
    const go = btn(S.listo ? 'Listo para el retiro ✓' : 'Preparar para el retiro', () => { if (S.listo) return; S.listo = true; $('#sello', sv).style.opacity = 1; go.disabled = true; go.textContent = 'Listo para el retiro ✓'; say('Material preparado para su retiro. Puedes continuar.'); estado(); chips(); }, 'p', { disabled: S.listo });
    scene().append(sv, fila(go, h('span', { className: 'pos' }, `Triturado: ${S.tri.length} · retirado a mano: ${conteo('metal') + conteo('roca') + conteo('otro')}`)));
  }

  // ---- etapa 8: salida ---------------------------------------------------------------------------------------------------
  function salida() {
    ES.tipo = 'dom'; const sv = SVG(FONDO + '<path d="M0 340h800" stroke="#2c4651" stroke-width="44"/><path d="M0 340h800" stroke="#8aa0a8" stroke-width="3" stroke-dasharray="22 16"/>'
      + `<g id="cam" style="transform:translateX(${S.salio ? 760 : 0}px)"><rect x="240" y="235" width="190" height="90" rx="4" fill="#cfd8dc" stroke="#fff" stroke-width="2"/>${[0, 1, 2, 3].map((i) => `<rect x="${252 + i * 44}" y="250" width="36" height="42" rx="6" fill="#fff" stroke="#9db2ba" stroke-width="2"/>`).join('')}<path d="M430 255h40l16 24v46h-56z" fill="#fff" stroke="#9db2ba" stroke-width="2"/><rect x="442" y="263" width="28" height="18" fill="#7ec8e3"/><circle cx="290" cy="329" r="17" fill="#111" stroke="#9db2ba" stroke-width="3"/><circle cx="450" cy="329" r="17" fill="#111" stroke="#9db2ba" stroke-width="3"/></g>`
      + '<text x="400" y="400" fill="#9db2ba" font-size="13" text-anchor="middle">Hacia un centro de acopio o gestor autorizado, según el tipo de residuo (ilustrativo)</text>', 'Un camión retira del sitio los sacos de material triturado y los materiales separados.');
    const res = h('div', { className: 'resumen', hidden: !S.salio });
    const resumen = () => { const ret = conteo('metal') + conteo('roca') + conteo('otro'); res.replaceChildren(h('h3', {}, 'Resumen de tu recorrido'), h('ul', {},
      h('li', {}, `Residuos recolectados: ${S.rec.length} (más ${S.extra.length} material arrastrado por la banda).`), h('li', {}, `Residuos clasificados: ${Object.keys(S.clas).length} de ${todos().length}.`),
      h('li', {}, `Material triturado: ${S.tri.length} piezas, enviadas a un centro de acopio o gestor autorizado.`), h('li', {}, `Materiales retirados a mano (metales, rocas y otros): ${ret}; su destino depende de cada material y de los procesos de gestión disponibles.`)),
      h('p', {}, 'Que un material salga del sistema no significa que se recicle automáticamente: el destino final depende del tipo de residuo y de la gestión disponible. Retirar los residuos flotantes a tiempo ayuda a evitar que se sigan dispersando por el cuerpo de agua.'),
      h('div', { className: 'ctrl' }, h('a', { className: 'btn p', href: '../' }, 'Volver al sitio'), h('a', { className: 'btn s', href: '../#contacto' }, 'Hablar con el equipo'))); res.hidden = false; };
    const go = btn(S.salio ? 'Transporte completado ✓' : 'Enviar al centro de acopio', () => {
      if (S.salio) return; go.disabled = true; go.textContent = 'En camino…'; const fin = () => { S.salio = true; $('#cam', sv).style.transform = 'translateX(760px)'; go.textContent = 'Transporte completado ✓'; resumen(); say('¡Recorrido completo! Revisa el resumen.'); estado(); chips(); };
      if (rm()) { fin(); return; } const a = $('#cam', sv).animate([{ transform: 'translateX(0)' }, { transform: 'translateX(760px)' }], { duration: 2200, easing: 'ease-in', fill: 'forwards' }); a.onfinish = fin; sync();
    }, 'p', { disabled: S.salio });
    if (S.salio) { resumen(); say('Recorrido completo. Revisa el resumen o reinícialo.'); }
    scene().append(sv, fila(go), res);
  }

  // ---- arranque -------------------------------------------------------------------------------------------------------------
  function iniciar() {
    try { $('#carga').hidden = true; $('#app').hidden = false; render(); if (location.search.includes('debug')) window.__exp = () => S; }
    catch (e) { console.error('[experiencia]', e); $('#app').hidden = true; const c = $('#carga'); c.hidden = false; c.className = 'estado err'; c.replaceChildren('No se pudo iniciar la experiencia. ', h('button', { type: 'button', className: 'btn s', on: { click: () => location.reload() } }, 'Reintentar')); }
  }
  iniciar();
})();
