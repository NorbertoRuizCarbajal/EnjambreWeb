/* Comportamiento de la landing (antes estaba en línea dentro de index.html; se movió aquí para que la
   Content-Security-Policy pueda prohibir scripts en línea). Se carga con defer. El menú está en js/menu.js y el formulario en colabora/ (js/contacto.js). */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const rm=matchMedia("(prefers-reduced-motion: reduce)").matches||(navigator.connection&&navigator.connection.saveData);
let pausado=rm;
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
