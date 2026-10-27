// Prueba de humo: abre la app en un navegador simulado y recorre las funciones principales.
// Uso: npm i --no-save jsdom@24.1.3 && node tests/smoke.cjs
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8").replace(/<link[^>]*fonts[^>]*>/g, "");
const errors = [];
const results = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously", pretendToBeVisual: true, url: "https://vidcreator.vercel.app/",
  beforeParse(w) {
    w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
      get: (t, k) => k === "measureText" ? (s => ({ width: String(s).length * 40 }))
        : k === "createLinearGradient" || k === "createRadialGradient" ? () => ({ addColorStop() {} })
        : k === "getImageData" ? () => ({ data: new Uint8ClampedArray(4) }) : () => {},
      set: () => true
    });
    w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    w.URL.createObjectURL = () => "blob:x";
    w.scrollTo = () => {};
    w.HTMLMediaElement.prototype.pause = function () {};
    w.HTMLMediaElement.prototype.play = async function () {};
    w.addEventListener("error", e => errors.push("window error: " + e.message));
    w.console.error = (...a) => errors.push("console: " + a.join(" "));
  }
});
const w = dom.window, doc = w.document;
const wait = ms => new Promise(r => setTimeout(r, ms));
const click = sel => { const el = doc.querySelector(sel); if (!el) { errors.push("falta " + sel); return; } el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); };
const type = (sel, v) => { const el = doc.querySelector(sel); if (!el) { errors.push("falta " + sel); return; } el.value = v; el.dispatchEvent(new w.Event("input", { bubbles: true })); };
const shown = s => (doc.querySelector("#app").textContent + doc.querySelector("#sheet").textContent).includes(s);
const check = (label, cond) => results.push([label, !!cond]);

(async () => {
  await wait(300);
  check("inicio: meta semanal", shown("Meta de la semana"));
  type("#f-idea", "Cómo pagué mi deuda en 8 meses"); click('[data-act="addIdea"]'); await wait(40);
  check("banco de ideas", shown("Cómo pagué mi deuda"));
  click('[data-act="homeView"][data-v="calendario"]'); await wait(30); check("calendario", shown("Sin fecha"));
  click('[data-act="homeView"][data-v="canal"]'); await wait(30); check("mi canal", shown("Salud del canal"));
  click('[data-act="homeView"][data-v="tablero"]'); await wait(30);

  [...doc.querySelectorAll('[data-act="open"]')].find(c => c.textContent.includes("Ejemplo")).dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await wait(40);
  check("guión: alerta en rojo del ejemplo", shown("suena muy genérico"));
  click('[data-act="tplOpen"]'); await wait(20); click('[data-act="tplPick"][data-v="tutorial"]'); await wait(20);
  type("#tq-gancho", "Vas a ordenar tus gastos en 20 minutos.");
  type("#tq-pasos", "Anota tus ingresos\nSepara gastos fijos\nDefine un monto de ahorro");
  type("#tq-cta", "Cuéntame cuánto ahorras al mes.");
  click('[data-act="tplBuild"]'); await wait(30);
  const script = doc.querySelector("#f-script").value;
  check("plantilla arma secciones y lista", script.includes("[GANCHO]") && script.includes("2. Separa gastos fijos"));

  for (const t of ["voz", "media", "mini", "titulos", "shorts", "orig", "publicar"]) { click('[data-act="tab"][data-t="' + t + '"]'); await wait(25); check("pestaña " + t, doc.querySelector(".tab.on") && doc.querySelector(".tab.on").dataset.t === t); }
  check("publicar: puntaje SEO", shown("Puntaje SEO"));
  check("publicar: capítulos", shown("Capítulos"));
  click('[data-act="tab"][data-t="titulos"]'); await wait(20);
  type("#f-title", "Cómo ordenar tus gastos en 20 minutos");
  click('[data-act="tab"][data-t="publicar"]'); await wait(20);
  type("#f-kw", "ordenar gastos");
  check("SEO se actualiza al escribir", doc.querySelector("#seoSlot") && doc.querySelector("#seoSlot").textContent.includes("Aparece completa"));

  click('[data-act="tab"][data-t="shorts"]'); await wait(20); click('[data-act="shortsAI"]'); await wait(40);
  check("modo gratis abre Usar con Claude", shown("Usar con Claude"));
  type("#aiPaste", '```json\n[{"titulo":"Ordena tus gastos","guion":"Te muestro cómo ordené mis gastos.","texto_miniatura":"20 MIN"}]\n```');
  click('[data-act="aiApply"]'); await wait(40);
  check("respuesta pegada se aplica", shown("Te muestro cómo ordené mis gastos"));

  // funciones puras
  const ch = w.eval(`(() => {
    const sr = 8000, sp = n => Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin(i / 3)), si = n => new Float32Array(n);
    const parts = []; for (let k = 0; k < 4; k++) { parts.push({ data: sp(sr * 14), sr }); parts.push({ data: si(sr * 0.8), sr }); }
    const x = AU.concat(parts, 0);
    const sc = "[GANCHO]\\nUno dos tres cuatro cinco seis.\\n[DESARROLLO]\\n1. Primer punto con varias palabras para hablar.\\n2. Segundo punto con varias palabras para hablar.\\n[CIERRE]\\nGracias por ver el video hasta el final.";
    return makeChapters(sc, x);
  })()`);
  check("capítulos empiezan en 00:00", ch.text && ch.text.startsWith("00:00 Introducción") && ch.list.length >= 3);
  const sil = w.eval(`(() => {
    const sr = 8000, sp = n => Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin(i / 3)), si = n => Float32Array.from({ length: n }, () => (Math.random() - 0.5) * 0.004);
    const x = AU.concat([{ data: sp(sr * 20), sr }, { data: si(sr * 1.5), sr }, { data: sp(sr * 20), sr }], 0);
    return [AU.dur(x), AU.dur(AU.removeSilence(x))];
  })()`);
  check("quitar silencios con pocas pausas", sil[1] < sil[0] - 1 && sil[1] > 40);
  const srt = w.eval(`toSRT([{ a: 0.5, b: 2.75, text: "Hola" }])`);
  check("formato SRT", srt.includes("00:00:00,500 --> 00:00:02,750"));

  const failed = results.filter(r => !r[1]);
  results.forEach(([l, ok]) => console.log((ok ? "OK   " : "FAIL ") + l));
  if (errors.length) console.log("ERRORES:", errors);
  process.exit(failed.length || errors.length ? 1 : 0);
})().catch(e => { console.log("CRASH", e); process.exit(1); });
