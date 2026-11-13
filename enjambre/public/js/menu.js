/* Menú principal (landing y colabora/). */
(() => {
const $=s=>document.querySelector(s);
const bm=$("#bm"),mn=$("#mn");
bm.onclick=()=>{const o=mn.classList.toggle("o");bm.setAttribute("aria-expanded",o);bm.setAttribute("aria-label",o?"Cerrar menú":"Abrir menú")};
mn.onclick=e=>{if(e.target.tagName=="A"){mn.classList.remove("o");bm.setAttribute("aria-expanded",false)}};
})();
