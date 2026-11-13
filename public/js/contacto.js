/* Formulario de colaboración (colabora/index.html): envío a /api/contact y animación de éxito.
   Usa js/mapa.js para el selector de país y el pin opcional (Enjambre.resetPin). */
(() => {
const $=s=>document.querySelector(s);
const pausado=matchMedia("(prefers-reduced-motion: reduce)").matches;
/* avispa de la animación de éxito: si la imagen no carga, se oculta (antes era un atributo onerror en línea) */
{const a=$("#vuelo .avi");if(a){if(a.complete&&!a.naturalWidth)a.hidden=true;a.addEventListener("error",()=>{a.hidden=true})}}
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
})();
