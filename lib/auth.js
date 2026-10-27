// Protege las funciones con un código de acceso (variable APP_CODE en Vercel).
// Sin él, cualquiera que conozca la URL podría gastar tus créditos de IA.
export function checkAuth(req, res) {
  const code = process.env.APP_CODE;
  if (!code) return true;
  if (req.headers["x-app-code"] === code) return true;
  res.status(401).json({ error: "Código de acceso incorrecto." });
  return false;
}

export function onlyMethod(req, res, method) {
  if (req.method === method) return true;
  res.setHeader("Allow", method);
  res.status(405).json({ error: "Método no permitido." });
  return false;
}
