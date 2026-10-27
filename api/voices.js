import { checkAuth } from "../lib/auth.js";

// Lista las voces disponibles en tu cuenta de ElevenLabs (incluye tus voces clonadas).
export default async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return res.status(503).json({ error: "Falta ELEVENLABS_API_KEY en Vercel." });
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: data?.detail?.message || "ElevenLabs respondió " + r.status });
    const voices = (data.voices || []).map(v => ({
      id: v.voice_id, name: v.name, category: v.category || "",
      labels: v.labels || {}, preview: v.preview_url || ""
    }));
    res.status(200).json({ voices });
  } catch (e) {
    res.status(502).json({ error: "No se pudo conectar con ElevenLabs." });
  }
}
