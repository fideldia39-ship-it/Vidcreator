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
    // Respuestas simuladas de Google/YouTube para probar la conexión sin cuenta real.
    const yt = {
      "youtube/v3/channels": { items: [{ id: "UC1", snippet: { title: "Canal de Prueba", thumbnails: {} }, statistics: { subscriberCount: "1520", viewCount: "48000", videoCount: "2" }, contentDetails: { relatedPlaylists: { uploads: "UU1" } } }] },
      "youtube/v3/playlistItems": { items: [{ contentDetails: { videoId: "v1" } }, { contentDetails: { videoId: "v2" } }] },
      "youtube/v3/videos": { items: [
        { id: "v1", snippet: { title: "Cómo ordenar tus gastos en 20 minutos", publishedAt: "2026-09-01T12:00:00Z", thumbnails: {} }, statistics: { viewCount: "3200", likeCount: "210", commentCount: "31" } },
        { id: "v2", snippet: { title: "Mi primer error con la tarjeta", publishedAt: "2026-09-15T12:00:00Z", thumbnails: {} }, statistics: { viewCount: "900", likeCount: "40", commentCount: "5" } }] },
      "filters=video": { columnHeaders: [{ name: "views" }, { name: "averageViewPercentage" }, { name: "averageViewDuration" }], rows: [[1250, 47.36, 96]] },
      "dimensions=video": { columnHeaders: [{ name: "video" }, { name: "views" }, { name: "estimatedMinutesWatched" }, { name: "averageViewDuration" }, { name: "averageViewPercentage" }, { name: "subscribersGained" }], rows: [["v1", 800, 900, 95, 52.1, 12], ["v2", 300, 200, 60, 38.4, 2]] }
    };
    w.fetch = async (url) => {
      url = String(url);
      const key = Object.keys(yt).find(k => url.includes(k));
      if (url.includes("googleapis.com") && key) return { ok: true, status: 200, json: async () => yt[key] };
      return { ok: false, status: 404, json: async () => ({}) };
    };
    w.google = { accounts: { oauth2: { initTokenClient: o => ({ requestAccessToken: () => setTimeout(() => o.callback({ access_token: "tok", expires_in: 3600 }), 5) }), revoke: () => {} } } };
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
  check("bienvenida en el primer uso", shown("Bienvenido a VidCreator"));
  click('[data-act="obNext"]'); await wait(20); click('[data-act="obNext"]'); await wait(20);
  type("#f-obniche", "finanzas personales y ahorro"); click('[data-act="obDone"]'); await wait(30);
  check("bienvenida se cierra", !shown("Bienvenido a VidCreator"));
  check("inicio: meta semanal", shown("Meta de la semana"));
  type("#f-idea", "Cómo pagué mi deuda en 8 meses"); click('[data-act="addIdea"]'); await wait(40);
  check("banco de ideas", shown("Cómo pagué mi deuda"));
  click('[data-act="homeView"][data-v="calendario"]'); await wait(30); check("calendario", shown("Sin fecha"));
  click('[data-act="homeView"][data-v="canal"]'); await wait(30); check("mi canal", shown("Salud del canal"));
  // plan de 30 días en modo gratis
  click('[data-act="homeView"][data-v="calendario"]'); await wait(30);
  click('[data-act="planOpen"]'); await wait(20);
  type("#f-pillars", "Ahorro diario\nErrores con plata\nInvertir desde cero");
  click('[data-act="planGen"]'); await wait(40);
  const planJson = JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ titulo: "Video plan " + (i + 1), pilar: ["Ahorro diario", "Errores con plata", "Invertir desde cero"][i % 3], formato: "historia", angulo: "ángulo " + i })));
  type("#aiPaste", planJson); click('[data-act="aiApply"]'); await wait(40);
  check("plan: propuesta con fechas", shown("Agregar los 9 al calendario"));
  click('[data-act="planAdd"]'); await wait(40);
  check("plan: agendado en el calendario", shown("Video plan 1"));
  // varios canales
  click('[data-act="chanOpen"]'); await wait(20);
  type("#f-newchan", "Canal de prueba"); click('[data-act="chanAdd"]'); await wait(30);
  check("canal nuevo activo y vacío", shown("Canal de prueba") && !shown("Video plan 1"));
  click('[data-act="chanOpen"]'); await wait(20); click('[data-act="chanPick"][data-id="main"]'); await wait(30);
  click('[data-act="homeView"][data-v="tablero"]'); await wait(30);
  check("volver al canal principal", shown("Video plan 1"));

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
  click('[data-act="tab"][data-t="mini"]'); await wait(20); click('[data-act="variants"]'); await wait(30);
  check("miniatura: 3 variantes", doc.querySelector("#vcv0") && doc.querySelector("#vcv2"));
  click('[data-act="tab"][data-t="publicar"]'); await wait(20);
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

  // conexión con YouTube (simulada)
  click('[data-act="home"]'); await wait(20); click('[data-act="settings"]'); await wait(30);
  type("#f-gcid", "123-prueba.apps.googleusercontent.com"); await wait(900);
  click('[data-act="home"]'); await wait(20); click('[data-act="homeView"][data-v="canal"]'); await wait(30);
  check("YouTube: botón conectar", shown("Conectar mi canal"));
  click('[data-act="ytSync"]'); await wait(200);
  check("YouTube: estadísticas del canal", shown("Canal de Prueba") && shown("1.520") && shown("52% retención"));
  const linked = w.eval(`projects().find(q => q.ytId === "v1")`);
  check("YouTube: vincula por título exacto", linked && linked.stage === "publicado");
  click('[data-act="homeView"][data-v="tablero"]'); await wait(30); click('[data-act="stageFilter"][data-v="todos"]'); await wait(20);
  [...doc.querySelectorAll('[data-act="open"]')].find(c => c.textContent.includes("Ejemplo")).dispatchEvent(new w.MouseEvent("click", { bubbles: true })); await wait(40);
  click('[data-act="tab"][data-t="publicar"]'); await wait(30);
  click('[data-act="ytResults"]'); await wait(150);
  const res = w.eval("cur().results");
  check("YouTube: trae vistas y retención a 7 días", res && res.views7 === "1250" && res.retention === "47.4");

  const failed = results.filter(r => !r[1]);
  results.forEach(([l, ok]) => console.log((ok ? "OK   " : "FAIL ") + l));
  if (errors.length) console.log("ERRORES:", errors);
  process.exit(failed.length || errors.length ? 1 : 0);
})().catch(e => { console.log("CRASH", e); process.exit(1); });
