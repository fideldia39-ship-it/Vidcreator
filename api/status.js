import { checkAuth } from "../lib/auth.js";

export default function handler(req, res) {
  if (!checkAuth(req, res)) return;
  res.status(200).json({
    ok: true,
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    voice: Boolean(process.env.ELEVENLABS_API_KEY),
    protected: Boolean(process.env.APP_CODE),
    model: process.env.AI_MODEL || "claude-sonnet-5-5"
  });
}
