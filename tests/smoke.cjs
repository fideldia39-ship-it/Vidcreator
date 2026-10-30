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
        { id: "v1", snippet: { title: "Cómo ordenar tus gastos en 20 minutos", publishedAt: "2026-09-01T12:00:00Z", channelId: "UC9", channelTitle: "Plata Simple", thumbnails: {} }, statistics: { viewCount: "3200", likeCount: "210", commentCount: "31" }, contentDetails: { duration: "PT10M" } },
        { id: "v2", snippet: { title: "Mi primer error con la tarjeta", publishedAt: "2026-09-15T12:00:00Z", thumbnails: {} }, statistics: { viewCount: "900", likeCount: "40", commentCount: "5" }, contentDetails: { duration: "PT8M30S" } }] },
      "filters=video": { columnHeaders: [{ name: "views" }, { name: "averageViewPercentage" }, { name: "averageViewDuration" }], rows: [[1250, 47.36, 96]] },
      "dimensions=video": { columnHeaders: [{ name: "video" }, { name: "views" }, { name: "estimatedMinutesWatched" }, { name: "averageViewDuration" }, { name: "averageViewPercentage" }, { name: "subscribersGained" }], rows: [["v1", 800, 900, 95, 52.1, 12], ["v2", 300, 200, 60, 38.4, 2]] }
    };
    // Drive simulado: guarda el último respaldo en memoria.
    let driveData = null; const driveBlobs = {};
    const readBlob = b => new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsText(b); });
    w.__driveBlobs = driveBlobs; w.__setDrive = d => { driveData = d; };
    const retRows = Array.from({ length: 100 }, (_, i) => [(i + 1) / 100, i < 20 ? 1 - i * 0.01 : i < 28 ? 0.8 - (i - 20) * 0.06 : 0.32 - (i - 28) * 0.002]);
    w.fetch = async (url, opts) => {
      url = String(url); opts = opts || {};
      const ok = j => ({ ok: true, status: 200, json: async () => j });
      if (url.includes("googleapis.com/upload/drive")) {
        const text = typeof opts.body === "string" ? opts.body : await readBlob(opts.body);
        const m = /\r\n\r\n(\{"app"[\s\S]*?\})\r\n--vcb/.exec(text);
        if (m) { driveData = JSON.parse(m[1]); return ok({ id: "f1" }); }
        const nm = /"name":"(blob-[^"]+)"/.exec(text); if (nm) { driveBlobs[nm[1]] = text.length; return ok({ id: "bl-" + nm[1] }); }
        driveData = { bad: true }; return ok({ id: "f1" });
      }
      if (url.includes("pageSize=1000")) return ok({ files: (driveData ? [{ id: "f1", name: "vidcreator-respaldo.json" }] : []).concat(Object.keys(driveBlobs).map(n => ({ id: "bl-" + n, name: n, size: String(driveBlobs[n]) }))) });
      if (url.includes("drive/v3/files?spaces")) return ok({ files: driveData ? [{ id: "f1", modifiedTime: "2026-10-29T00:00:00Z" }] : [] });
      if (url.includes("drive/v3/files/f1?alt=media")) return ok(driveData);
      if (url.includes("drive/v3/files/bl-")) return { ok: true, status: 200, blob: async () => new w.Blob(["abc"], { type: "audio/webm" }) };
      if (url.includes("v3/search")) return ok({ items: [{ id: { videoId: "v1" } }, { id: { videoId: "v2" } }] });
      if (url.includes("channels?part=statistics&id=")) return ok({ items: [{ id: "UC9", statistics: { subscriberCount: "800" } }] });
      if (url.includes("commentThreads")) return ok({ items: [{ snippet: { topLevelComment: { snippet: { textDisplay: "¿Cómo hiciste para ahorrar el primer mes?", likeCount: 7 } } } }, { snippet: { topLevelComment: { snippet: { textDisplay: "Muy buen video", likeCount: 2 } } } }] });
      if (url.includes("creatorContentType")) {
        const q = new URL(url).searchParams, days = (new Date(q.get("endDate")) - new Date(q.get("startDate"))) / 86400000, metric = q.get("metrics");
        const rows = metric === "views" ? [["SHORTS", 40000], ["VIDEO_ON_DEMAND", 5000]] : days > 300 ? [["SHORTS", 9000], ["VIDEO_ON_DEMAND", 120000]] : [["SHORTS", 1000], ["VIDEO_ON_DEMAND", 12000]];
        return ok({ columnHeaders: [{ name: "creatorContentType" }, { name: metric }], rows });
      }
      if (url.includes("subscribersGained,subscribersLost")) return ok({ columnHeaders: [{ name: "subscribersGained" }, { name: "subscribersLost" }], rows: [[90, 10]] });
      if (url.includes("elapsedVideoTimeRatio")) return ok({ columnHeaders: [{ name: "elapsedVideoTimeRatio" }, { name: "audienceWatchRatio" }], rows: retRows });
      const key = Object.keys(yt).find(k => url.includes(k));
      if (url.includes("googleapis.com") && key) return ok(yt[key]);
      return { ok: false, status: 404, json: async () => ({}) };
    };
    w.__drive = () => driveData;
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


  // ---- mejoras 1.7 ----
  click('[data-act="home"]'); await wait(20); click('[data-act="homeView"][data-v="canal"]'); await wait(30);
  check("monetización: camino y metas", shown("Camino a la monetización") && shown("Nivel 1") && shown("Nivel 2"));
  check("monetización: horas sin Shorts (2.000 h)", shown("2.000 / 3.000"));
  check("monetización: suscriptores 1.520 de 1.000", shown("1.520 / 1.000"));
  check("monetización: ritmo semanal", shown("a este ritmo") || shown("Meta cumplida"));
  check("Drive: respaldo automático al actualizar", w.__drive() && w.__drive().app === "vidcreator" && Object.keys(w.__drive().docs).length > 2);
  const before = w.eval("Object.keys(S.docs).filter(k => S.docs[k].kind === 'project').length");
  w.eval("(() => { const k = Object.keys(S.docs).find(k => S.docs[k].kind === 'project' && S.docs[k].example); delete S.docs[k]; })()");
  const restored = await w.eval("driveRestore()");
  check("Drive: restaurar trae el video borrado", restored === 1 && w.eval("Object.keys(S.docs).filter(k => S.docs[k].kind === 'project').length") === before);
  click('[data-act="settings"]'); await wait(40);
  check("Ajustes: sincronizar con Drive", shown("Sincronizar con Google Drive") && shown("Sincronizar ahora") && shown("Mi estilo"));
  click('[data-act="driveBackup"]'); await wait(120);
  check("Drive: guardar manual deja fecha", w.eval("!!settings().driveAt"));
  click('[data-act="home"]'); await wait(20);

  // series (modo gratis)
  click('[data-act="homeView"][data-v="canal"]'); await wait(30); click('[data-act="canalTab"][data-v="audiencia"]'); await wait(30);
  check("series: tarjeta", shown("Series para subir tus horas"));
  click('[data-act="seriesAI"]'); await wait(40);
  type("#aiPaste", JSON.stringify([{ serie: "Mis errores con la tarjeta", por_que: "Tu video de errores retuvo más", videos: [{ titulo: "El error de pagar el mínimo", angulo: "mi caso real" }, { titulo: "Cómo salí del mínimo", angulo: "pasos que seguí" }, { titulo: "Lo que haría distinto", angulo: "reflexión" }] }]));
  click('[data-act="aiApply"]'); await wait(40);
  check("series: propuesta visible", shown("Mis errores con la tarjeta") && shown("El error de pagar el mínimo"));
  click('[data-act="seriesAdd"]'); await wait(40);
  check("series: se agregan como ideas", w.eval("projects().filter(q => /Serie «Mis errores/.test(q.topic)).length") === 3);

  // recordatorios
  const ics = w.eval("makeICS(projects())");
  check("calendario: archivo .ics con alarmas", ics.startsWith("BEGIN:VCALENDAR") && ics.includes("Publicar: Video plan") && ics.includes("BEGIN:VALARM") && ics.includes("\r\n"));
  click('[data-act="homeView"][data-v="tablero"]'); await wait(30);
  check("Hoy: tarjeta con recordatorios", shown("Agregar mis fechas al calendario"));

  // gancho
  const hk = w.eval(`hookCheck({ script: "[GANCHO]\\nHola a todos y bienvenidos, en este video te voy a mostrar la clave del éxito.\\n[DESARROLLO]\\nTexto." })`);
  const hk2 = w.eval(`hookCheck({ script: "[GANCHO]\\nPerdí 800 mil pesos en una semana por un error que cometí con mi tarjeta.\\n[DESARROLLO]\\nTexto." })`);
  check("gancho: detecta saludo y relleno", hk && hk.items.find(i => i.l === "Cómo empieza").st === "bad" && hk.items.find(i => i.l === "Frases de relleno").st === "bad");
  check("gancho: premia dato y experiencia propia", hk2 && hk2.score > hk.score && hk2.items.find(i => i.l === "Dato concreto").st === "ok");

  // políticas
  const pol = w.eval(`policyCheck({ script: "Invierte y gana dinero fácil, garantizado.", title: "NO VAS A CREER ESTO!!", description: "Usa mi código de descuento", voice: "ia", media: [{ origin: "ia" }], music: { id: "m" } })`);
  const stOf = l => pol.find(i => i.l === l).st;
  check("políticas: promesas, voz IA, clickbait, promoción, IA sin declarar", stOf("Promesas de dinero") === "bad" && stOf("Voz IA en finanzas") === "bad" && stOf("Título engañoso") === "warn" && stOf("Promoción pagada") === "warn" && stOf("Contenido sintético") === "warn");

  // ajuste de subtítulos a las pausas
  const cuesOk = w.eval(`(() => {
    const sr = 8000, sp = n => Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin(i / 3)), si = n => new Float32Array(n);
    const parts = [sp(sr * 5), si(sr * 0.8), sp(sr * 9), si(sr * 0.8), sp(sr * 4), si(sr * 0.8), sp(sr * 7)].map(d => ({ data: d, sr }));
    const x = AU.concat(parts, 0);
    const chunks = ["a".repeat(50) + ".", "b".repeat(90) + ".", "c".repeat(40) + ".", "d".repeat(70) + "."];
    const c = timeChunks(chunks, x), pauses = [5.4, 15.2, 20.0];
    let mono = true; for (let i = 1; i < c.length; i++) if (c[i].a < c[i - 1].a + 0.25) mono = false;
    return { n: c.length, mono, d: [c[1].a - pauses[0], c[2].a - pauses[1], c[3].a - pauses[2]] };
  })()`);
  check("subtítulos: cortes en las pausas reales", cuesOk.n === 4 && cuesOk.mono && cuesOk.d.every(v => Math.abs(v) < 0.6));

  // editor de subtítulos
  w.eval(`(() => { const p = cur(); p.takes = [{ id: "t1", name: "Prueba", kind: "grabacion", dur: 10 }]; S.pv = { takeId: "t1", imgs: [], dur: 10, idx: -1, audio: new Audio(), cues: [{ a: 0, b: 4, text: "Hola mundo" }, { a: 4, b: 8, text: "Segunda frase" }] }; S.sheet = { type: "preview" }; renderSheet(); })()`);
  await wait(20); click('[data-act="cqOpen"]'); await wait(20);
  check("subtítulos: editor abre", shown("Revisar subtítulos") && shown("Hola mundo"));
  type('[data-cq="0"]', "Hola a todos"); click('[data-act="cqNudge"][data-i="1"][data-d="0.3"]'); await wait(10);
  click('[data-act="cqSave"]'); await wait(30);
  const tk = w.eval("cur().takes[0]");
  check("subtítulos: se guardan editados", tk.cues && tk.cues[0].text === "Hola a todos" && Math.abs(tk.cues[1].a - 4.3) < 0.01 && tk.cuesDur === 10);
  const reused = w.eval(`cuesFor(cur(), cur().takes[0], { data: new Float32Array(80000), sr: 8000 })[0].text`);
  check("subtítulos: se reutilizan si el audio no cambió", reused === "Hola a todos");
  w.eval("S.sheet = null; S.pv = null; renderSheet()");

  // retención y revisión del gancho en el video vinculado
  click('[data-act="stageFilter"][data-v="todos"]'); await wait(20);
  [...doc.querySelectorAll('[data-act="open"]')].find(c => c.textContent.includes("Ejemplo")).dispatchEvent(new w.MouseEvent("click", { bubbles: true })); await wait(40);
  click('[data-act="tab"][data-t="publicar"]'); await wait(30);
  check("publicar: revisión de políticas", shown("Revisión de políticas"));
  click('[data-act="ytRetention"]'); await wait(150);
  check("retención: curva y mayor caída", shown("Siguen a los 30 s") && shown("Mayor caída") && shown("Llegan al final"));
  const ins = w.eval("retentionInsights(cur())");
  check("retención: caída entre 20% y 30% y 30 s", ins && ins.dropFrom >= 0.15 && ins.dropFrom <= 0.3 && Math.abs(ins.first30 - 0.9) < 0.1);
  click('[data-act="tab"][data-t="guion"]'); await wait(30);
  check("guión: revisar mi gancho", shown("Revisar mi gancho") && shown("Pedir 3 direcciones"));
  click('[data-act="hookAI"]'); await wait(40);
  type("#aiPaste", JSON.stringify({ puntaje: 60, problemas: ["Empieza con saludo"], direcciones: [{ enfoque: "empezar por el error", como: "Abre con el error que cometiste" }, { enfoque: "una pregunta", como: "Pregunta qué harías" }, { enfoque: "el resultado", como: "Abre con el monto" }] }));
  click('[data-act="aiApply"]'); await wait(40);
  check("gancho: direcciones de la IA", shown("empezar por el error") && shown("Abre con el monto"));


  // ---- mejoras 1.8 ----
  click('[data-act="home"]'); await wait(30);
  check("navegación inferior con 5 secciones", doc.querySelectorAll("#nav button").length === 5 && !doc.querySelector("#nav").hidden);
  click('#nav [data-act="homeView"][data-v="canal"]'); await wait(30); click('[data-act="canalTab"][data-v="resumen"]'); await wait(30);
  check("canal: tarjeta Tu año", shown("Tu año"));
  // investigar
  click('#nav [data-act="homeView"][data-v="investigar"]'); await wait(30);
  type("#f-research", "cómo ordenar mis gastos"); click('[data-act="rsSearch"]'); await wait(150);
  check("investigar: resultados con vistas", shown("Videos sobre") && shown("Cómo ordenar tus gastos en 20 minutos") && shown("Vistas típicas"));
  check("investigar: detecta canal chico que despegó", shown("Canal chico, buen resultado"));
  click('[data-act="rsNote"][data-i="0"]'); await wait(30);
  check("investigar: anota el tema como idea", w.eval("projects().some(q => /Referencia: «/.test(q.topic))"));
  click('[data-act="rsAngles"]'); await wait(40);
  type("#aiPaste", JSON.stringify([{ titulo: "Mi sistema de 3 sobres", angulo: "mi método real", formato: "historia" }])); click('[data-act="aiApply"]'); await wait(40);
  check("investigar: ángulos propios", shown("Mi sistema de 3 sobres"));
  // ingresos
  click('#nav [data-act="homeView"][data-v="canal"]'); await wait(30); click('[data-act="canalTab"][data-v="ingresos"]'); await wait(30);
  type("#f-iamt", "35.000"); click('[data-act="incSrc"][data-v="afiliados"]'); type("#f-iamt", "35.000"); click('[data-act="incAdd"]'); await wait(30);
  check("ingresos: registra y suma", shown("$35.000") && w.eval("chan().income.length") === 1 && w.eval("chan().income[0].src") === "afiliados");
  type("#f-igoal", "100000"); await wait(900);
  check("ingresos: meta mensual", w.eval("num(chan().incomeGoal)") === 100000);
  click('[data-act="incDel"]'); await wait(30);
  check("ingresos: se puede quitar", w.eval("chan().income.length") === 0);
  // comentarios
  click('[data-act="canalTab"][data-v="audiencia"]'); await wait(30); click('[data-act="cmLoad"]'); await wait(150);
  check("comentarios: detecta preguntas", shown("comentarios leídos") && shown("Cómo hiciste para ahorrar el primer mes") && !shown("Muy buen video"));
  click('[data-act="cmAI"]'); await wait(40);
  type("#aiPaste", JSON.stringify({ temas: ["Ahorro inicial"], dudas: ["¿Cómo empezar?"], ideas: [{ titulo: "Mi primer mes ahorrando", angulo: "con números reales", formato: "historia" }] })); click('[data-act="aiApply"]'); await wait(40);
  click('[data-act="cmAdd"]'); await wait(30);
  check("comentarios: ideas de la audiencia al banco", w.eval("projects().some(q => /pedido por tu audiencia/.test(q.topic))"));
  // estilo
  w.eval('chan().style = "Hola, yo perdí plata por no revisar mis gastos."');
  check("estilo: se agrega a las instrucciones de la IA", w.eval('promptFix({ script: "x", topic: "t", voice: "propia" }).includes("Muestras de cómo escribe") && promptTitles({ script: "x", topic: "t" }).includes("perdí plata")'));
  w.eval("delete chan().style");
  check("estilo: sin muestras no agrega nada", !w.eval('promptFix({ script: "x", topic: "t", voice: "propia" }).includes("Muestras de cómo escribe")'));
  // prueba de miniaturas
  const tt = w.eval(`thumbTestCard([{ results: { thumbVar: "v1", ctr: "4,0" } }, { results: { thumbVar: "v2", ctr: "7,5" } }, { results: { thumbVar: "v2", ctr: "6,5" } }])`);
  check("miniaturas: gana la variante con más CTR", tt.includes("Qué miniatura gana") && tt.indexOf("Variante 2") < tt.indexOf("Variante 1") && tt.includes("7.0% CTR"));
  // fusión y sincronización
  const mg = w.eval(`(() => {
    S.docs.A = newProject({ name: "A local" }); S.docs.A.updatedAt = 100; S.docs.B = newProject({ name: "B local" }); S.docs.B.updatedAt = 100;
    const r = mergeDocs({ docs: { A: Object.assign(newProject({ name: "A remoto" }), { updatedAt: 200 }), C: Object.assign(newProject({ name: "C remoto" }), { updatedAt: 50 }),
      settings: { deleted: { B: 150 }, channels: [{ id: "otro", name: "Canal extra", hooks: [] }] } } });
    return [r.added, r.updated, r.removed, S.docs.A.name, !!S.docs.B, S.docs.C && S.docs.C.name, channels().some(c => c.id === "otro")];
  })()`);
  check("fusión: nuevo, actualizado más reciente y borrado", mg[0] === 1 && mg[1] === 1 && mg[2] === 1 && mg[3] === "A remoto" && mg[4] === false && mg[5] === "C remoto" && mg[6] === true);
  const keepLocal = w.eval(`(() => { S.docs.A.updatedAt = 900; const r = mergeDocs({ docs: { A: Object.assign(newProject({ name: "A viejo" }), { updatedAt: 300 }) } }); return [r.updated, S.docs.A.name]; })()`);
  check("fusión: la versión local más nueva se conserva", keepLocal[0] === 0 && keepLocal[1] === "A remoto");
  const del = w.eval(`(() => { settings().deleted = { Z: 5000 }; S.docs.Z = Object.assign(newProject({ name: "Z" }), { updatedAt: 100 }); const r = mergeDocs({ docs: {} }); return [r.removed, !!S.docs.Z]; })()`);
  check("fusión: respeta lo que borraste en este aparato", del[0] === 1 && del[1] === false);
  w.eval(`(() => { S.docs.SY = newProject({ name: "Con audio", takes: [{ id: "tk-sync", name: "Toma", kind: "grabacion" }] }); })()`);
  await w.eval(`DB.put("blobs", "tk-sync", new Blob(["abc"], { type: "audio/webm" }))`);
  const up = await w.eval("driveSync(null, true)");
  check("sincronizar: sube el archivo que falta en Drive", up.up >= 1 && Object.keys(w.__driveBlobs).includes("blob-tk-sync"));
  await w.eval(`DB.del("blobs", "tk-sync")`);
  const down = await w.eval("driveSync(null, true)");
  const back = await w.eval(`DB.get("blobs", "tk-sync")`);
  check("sincronizar: baja el archivo que falta aquí", down.down === 1 && back && back.size === 3);
  check("sincronizar: mensaje claro", w.eval(`syncText({ added: 2, updated: 1, removed: 0, up: 1, down: 0, skipped: 0 })`) === "Sincronizado: 2 video(s) nuevos, 1 actualizados, 1 archivo(s) subidos");

  const failed = results.filter(r => !r[1]);
  results.forEach(([l, ok]) => console.log((ok ? "OK   " : "FAIL ") + l));
  if (errors.length) console.log("ERRORES:", errors);
  process.exit(failed.length || errors.length ? 1 : 0);
})().catch(e => { console.log("CRASH", e); process.exit(1); });
