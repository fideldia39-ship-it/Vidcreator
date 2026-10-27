import { checkAuth, onlyMethod } from "../lib/auth.js";

// Llama a Claude (Messages API). Recibe { prompt, images?: [{ data, media_type }] }
// y devuelve { text }. La app pide JSON en el prompt y lo interpreta en el teléfono.
export default async function handler(req, res) {
  if (!onlyMethod(req, res, "POST") || !checkAuth(req, res)) return;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: "Falta ANTHROPIC_API_KEY en Vercel." });

  const { prompt, images } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim()) return res.status(400).json({ error: "Falta el texto." });
  if (prompt.length > 60000) return res.status(413).json({ error: "El texto es demasiado largo." });

  const content = [];
  for (const im of Array.isArray(images) ? images.slice(0, 2) : []) {
    if (im && typeof im.data === "string" && /^image\/(jpeg|png|webp|gif)$/.test(im.media_type)) {
      content.push({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } });
    }
  }
  content.push({ type: "text", text: prompt });

  const model = process.env.AI_MODEL || "claude-sonnet-5-5";
  const body = { model, max_tokens: 8000, messages: [{ role: "user", content }] };
  // Sonnet 5.5 piensa por defecto; "between_tools" apaga el pensamiento inicial para responder más rápido.
  if (model === "claude-sonnet-5-5") body.thinking = { type: "between_tools" };

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.error?.message || "Error de la IA (" + r.status + ").";
      return res.status(r.status === 429 ? 429 : 502).json({ error: msg });
    }
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    res.status(200).json({ text, stop_reason: data.stop_reason });
  } catch (e) {
    res.status(502).json({ error: "No se pudo conectar con la IA." });
  }
}
