import { checkAuth, onlyMethod } from "../lib/auth.js";

// Convierte un tramo de texto en audio MP3 con ElevenLabs. La app divide el guión
// en tramos cortos y los une en el teléfono, así cada respuesta queda bajo el límite de Vercel.
export default async function handler(req, res) {
  if (!onlyMethod(req, res, "POST") || !checkAuth(req, res)) return;
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return res.status(503).json({ error: "Falta ELEVENLABS_API_KEY en Vercel." });

  const { voiceId, text } = req.body || {};
  if (!/^[A-Za-z0-9]{6,64}$/.test(String(voiceId || ""))) return res.status(400).json({ error: "Voz no válida." });
  if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "Falta el texto." });
  if (text.length > 3000) return res.status(413).json({ error: "Tramo demasiado largo." });

  const model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + voiceId + "?output_format=mp3_44100_64", {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: model })
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      const msg = data?.detail?.message || data?.detail || "ElevenLabs respondió " + r.status;
      return res.status(r.status === 429 ? 429 : 502).json({ error: String(msg) });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).json({ error: "No se pudo conectar con ElevenLabs." });
  }
}
