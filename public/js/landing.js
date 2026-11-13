/* Comportamiento de la landing (antes estaba en línea dentro de index.html; se movió aquí para que la
   Content-Security-Policy pueda prohibir scripts en línea). Se carga con defer, después de js/mapa.js. */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const rm=matchMedia("(prefers-reduced-motion: reduce)").matches||(navigator.connection&&navigator.connection.saveData);
let pausado=rm;
/* avispa de la animación de éxito: si la imagen no carga, se oculta (antes era un atributo onerror en línea) */
{const a=$("#vuelo .avi");if(a){if(a.complete&&!a.naturalWidth)a.hidden=true;a.addEventListener("error",()=>{a.hidden=true})}}
/* menú */
const bm=$("#bm"),mn=$("#mn");
bm.onclick=()=>{const o=mn.classList.toggle("o");bm.setAttribute("aria-expanded",o);bm.setAttribute("aria-label",o?"Cerrar menú":"Abrir menú")};
mn.onclick=e=>{if(e.target.tagName=="A"){mn.classList.remove("o");bm.setAttribute("aria-expanded",false)}};
/* video: carga diferida, reproduce solo en pantalla */
const vio=new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;
 if(e.isIntersecting){if(!v.src&&!rm)v.src=v.dataset.src;if(!pausado&&v.src)v.play().catch(()=>{})}else v.pause()}),{rootMargin:"200px"});
$$("video").forEach(v=>vio.observe(v));
/* pausa global */
const pz=$("#pz");if(rm){pz.textContent="Reanudar movimiento";pz.setAttribute("aria-pressed","true");document.documentElement.classList.add("pz")}
pz.onclick=()=>{pausado=!pausado;pz.setAttribute("aria-pressed",pausado);pz.textContent=pausado?"Reanudar movimiento":"Pausar movimiento";
 document.documentElement.classList.toggle("pz",pausado);
 $$("video").forEach(v=>{if(pausado)v.pause();else{if(!v.src)v.src=v.dataset.src;const r=v.getBoundingClientRect();if(r.bottom>0&&r.top<innerHeight)v.play().catch(()=>{})}})};
/* hilo conductor */
const fl=$("#flujo"),dots=$$("#flujo a"),etapas=dots.map(a=>$("#"+a.dataset.e)),pr=$("#proceso"),ct=$("#contencion"),zm=$("[data-zoom]");
const eio=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){const i=etapas.indexOf(e.target);dots.forEach((d,k)=>d.classList.toggle("on",k<=i))}}),{rootMargin:"-45% 0px -45% 0px"});
etapas.forEach(s=>eio.observe(s));
let tk=0;function sc(){tk=0;const y=scrollY,h=innerHeight;
 $("#top").classList.toggle("sc",y>40);
 const a=pr.offsetTop,b=ct.offsetTop+ct.offsetHeight;
 fl.classList.toggle("on",y+h*.5>a+pr.offsetHeight*.6&&y+h*.5<b);
 if(y+h*.5<a+pr.offsetHeight)dots.forEach(d=>d.classList.remove("on"));
 const p=Math.min(1,Math.max(0,(y+h*.5-etapas[0].offsetTop)/(b-etapas[0].offsetTop)));fl.style.setProperty("--p",p);
 if(!pausado){const t=Math.min(1,Math.max(0,(y+h-a)/(pr.offsetHeight+h)));zm.style.setProperty("--z",1+t*.12)}}
addEventListener("scroll",()=>{if(!tk)tk=requestAnimationFrame(sc)},{passive:true});sc();
/* Interacción de éxito: CONFIGURACIÓN. total = duración en ms (1200–1800); dist_arco = elevación del vuelo en px */
const VUELO={total:1500,dist_arco:24};
function vuelo(on){const v=$("#vuelo");if(!v)return;
 v.getAnimations({subtree:true}).forEach(a=>a.cancel());v.classList.remove("est");if(!on)return;
 try{const av=v.querySelector(".avi"),hx=v.querySelector(".hex"),gl=v.querySelector(".glow");
  if(matchMedia("(prefers-reduced-motion: reduce)").matches||pausado){if(!av.hidden)v.classList.add("est");return}
  const b=$("#fm .envio .btn").getBoundingClientRect(),c=v.getBoundingClientRect(),
   dx=b.left+b.width/2-(c.left+c.width/2),dy=b.top+b.height/2-(c.top+c.height/2),
   r=Math.atan2(-dx,dy)*180/Math.PI,T=VUELO.total,o={duration:T,easing:"ease-in-out"},A=VUELO.dist_arco;
  v.animate([{opacity:0},{opacity:1,offset:.13},{opacity:1,offset:.87},{opacity:0}],{duration:T});
  if(!av.hidden)av.animate([{transform:`translate(${dx}px,${dy}px) rotate(${r}deg) scale(.8)`,opacity:0},{opacity:1,offset:.1},
   {transform:`translate(${dx*.45}px,${dy*.45-A}px) rotate(${r*.5}deg) scale(.9)`,offset:.45},
   {transform:"translate(0,0) rotate(0deg) scale(.8)",opacity:1,offset:.66},{transform:"translate(0,0) rotate(0deg) scale(.5)",opacity:0,offset:.82},{opacity:0}],o);
  hx.animate([{transform:"scale(1)"},{transform:"scale(1)",offset:.64},{transform:"scale(1.2)",offset:.76},{transform:"scale(1)"}],{duration:T});
  gl.animate([{transform:"scale(.6)",opacity:0},{transform:"scale(.6)",opacity:0,offset:.62},{transform:"scale(1)",opacity:.9,offset:.74},{transform:"scale(1.5)",opacity:0}],{duration:T})
 }catch(e){}}
/* Formulario. Estados (data-estado en <form>): idle → validating → submitting → success | error.
   Nunca se muestra éxito sin respuesta {ok:true} del servidor; ante un error recuperable se conservan los datos. */
const CONTACTO="proyectoenjambre.contacto@gmail.com",ETQ="Enviar mensaje";
function est(f,s){f.dataset.estado=s;f.setAttribute("aria-busy",s==="submitting")}
function msgFallo(c,e){
 if(c===0)return"No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo; tus datos siguen aquí.";
 if(c===400)return"Revisa los campos marcados e inténtalo de nuevo.";
 if(c===429)return"Recibimos varios envíos desde tu conexión. Inténtalo de nuevo más tarde.";
 if(c===404||c===405||c===403)return"El servicio de envío no está disponible en este sitio todavía (código "+c+"). Escríbenos a "+CONTACTO+".";
 if(e==="config")return"El envío aún no está configurado en el servidor. Escríbenos a "+CONTACTO+".";
 return"No pudimos guardar tu mensaje en este momento. Inténtalo de nuevo; tus datos siguen aquí. Si persiste, escríbenos a "+CONTACTO+"."}
$("#fm").onsubmit=async e=>{e.preventDefault();const f=e.target,st=$("#st"),bt=f.querySelector(".envio .btn");
 if(f.dataset.estado==="submitting")return;
 est(f,"validating");
 if(!f.checkValidity()){f.reportValidity();st.textContent="Revisa los campos marcados e inténtalo de nuevo.";est(f,"idle");return}
 const d=Object.fromEntries(new FormData(f));d.consentimiento_ubicacion=!!f.consentimiento_ubicacion.checked;if(!d.lat||!d.lng){delete d.lat;delete d.lng}
 est(f,"submitting");vuelo(false);bt.disabled=true;bt.classList.add("load");st.textContent="Enviando…";
 const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),20000);let ok=false,code=0,err="";
 try{const r=await fetch("/api/contact",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d),signal:ctl.signal});
  code=r.status;const j=await r.json().catch(()=>null);ok=r.ok&&!!j&&j.ok===true;err=j&&j.error||""}
 catch(x){code=0}
 clearTimeout(to);bt.disabled=false;bt.classList.remove("load");st.tabIndex=-1;
 if(ok){est(f,"success");bt.textContent=ETQ;
  st.textContent="Gracias por contactar a Enjambre. Recibimos tu mensaje y revisaremos tu solicitud para responderte lo antes posible.";vuelo(true);f.reset();if(window.Enjambre&&Enjambre.resetPin)Enjambre.resetPin()}
 else{console.error("[contacto] fallo",code,err);est(f,"error");bt.textContent="Reintentar envío";st.textContent=msgFallo(code,err)}
 st.focus({preventScroll:false})};
