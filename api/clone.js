import { checkAuth, onlyMethod } from "../lib/auth.js";

// Crea una copia IA de TU voz en ElevenLabs a partir de tus grabaciones.
// Recibe { name, files: [{ b64, type, name }] } (WAV 16 kHz mono que prepara la app).
export default async function handler(req, res) {
  if (!onlyMethod(req, res, "POST") || !checkAuth(req, res)) return;
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return res.status(503).json({ error: "Falta ELEVENLABS_API_KEY en Vercel." });

  const { name, files, consent } = req.body || {};
  if (consent !== true) return res.status(400).json({ error: "Falta confirmar que es tu propia voz." });
  if (!Array.isArray(files) || !files.length) return res.status(400).json({ error: "Faltan las grabaciones." });

  const form = new FormData();
  form.append("name", String(name || "Mi voz").slice(0, 60));
  form.append("description", "Voz propia creada desde VidCreator");
  form.append("remove_background_noise", "false");
  files.slice(0, 5).forEach((f, i) => {
    const bytes = Buffer.from(String(f.b64 || ""), "base64");
    form.append("files", new Blob([bytes], { type: f.type || "audio/wav" }), f.name || "muestra-" + (i + 1) + ".wav");
  });

  try {
    const r = await fetch("https://api.elevenlabs.io/v1/voices/add", { method: "POST", headers: { "xi-api-key": key }, body: form });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.detail?.message || (typeof data?.detail === "string" ? data.detail : "") || "ElevenLabs respondió " + r.status;
      return res.status(502).json({ error: msg });
    }
    res.status(200).json({ voiceId: data.voice_id, requiresVerification: Boolean(data.requires_verification) });
  } catch (e) {
    res.status(502).json({ error: "No se pudo conectar con ElevenLabs." });
  }
}
