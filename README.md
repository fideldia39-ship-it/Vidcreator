# VidCreator — guía de instalación

App para preparar videos de YouTube desde el celular: guión corregido con IA, grabación y edición de tu voz, voces IA, fotos y videos, miniatura, títulos, descripción y la alerta de originalidad.

Se instala como app (PWA) desde el navegador. Tus videos, fotos y audios quedan guardados **en el teléfono**. Solo la IA y las voces IA pasan por internet.

## Qué hay en la carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La app completa |
| `manifest.webmanifest`, `sw.js`, `icons/` | Lo que la hace instalable y le permite abrir sin conexión |
| `api/ai.js` | Conecta con Claude (corregir guión, títulos, originalidad, miniatura, descripción) |
| `api/tts.js`, `api/voices.js`, `api/clone.js` | Conectan con ElevenLabs (voces IA y copia de tu voz) |
| `api/status.js`, `lib/auth.js` | Revisan la conexión y protegen tus claves con un código |

## 1. Consigue tus claves

1. **Claude (obligatoria para la IA de textos):** crea una cuenta en https://console.anthropic.com, carga saldo y crea una API key.
2. **ElevenLabs (solo si quieres voces IA):** crea una cuenta en https://elevenlabs.io y copia tu API key desde tu perfil. La copia de tu propia voz depende del plan que tengas.
3. **Código de acceso:** inventa una clave (por ejemplo `fidel-2026-videos`). La app la pide para que nadie más gaste tu saldo si encuentra la URL.

Ambos servicios cobran por uso. Revisa sus páginas de precios antes de empezar.

## 2. Súbela a Vercel

1. Crea un repositorio nuevo en GitHub (privado) y sube **todo el contenido** de esta carpeta.
2. En https://vercel.com → **Add New → Project** → elige ese repositorio. No cambies nada de la configuración de compilación.
3. Antes de darle a Deploy, abre **Environment Variables** y agrega:

| Nombre | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | tu clave de Claude |
| `ELEVENLABS_API_KEY` | tu clave de ElevenLabs (opcional) |
| `APP_CODE` | tu código de acceso |
| `AI_MODEL` | opcional. Por defecto usa `claude-sonnet-5-5`. Para gastar menos: `claude-haiku-5-5` |
| `ELEVENLABS_MODEL` | opcional. Por defecto `eleven_multilingual_v2` |

4. **Deploy.** Si agregas o cambias variables después, haz **Redeploy** para que se apliquen.

## 3. Instálala en tu teléfono

1. Abre la URL de Vercel en el teléfono.
2. **Android (Chrome):** menú ⋮ → **Instalar app**. **iPhone (Safari):** botón Compartir → **Agregar a inicio**.
3. Abre la app → ícono de engranaje → **Ajustes** → escribe tu código de acceso → **Guardar y probar**. Debe decir "Lista" en IA y en Voces.
4. La primera vez que grabes, acepta el permiso de micrófono.

## Cosas a tener en cuenta

- **Respaldo:** como todo vive en el teléfono, descarga un respaldo de vez en cuando desde Ajustes. Si borras los datos del navegador o la app, se pierden los videos.
- **Video final:** la app prepara guión, narración, fotos, miniatura y textos. El montaje se hace en CapCut: desde el editor de audio usa **Compartir (CapCut)** para pasarle la narración.
- **Voz IA y monetización:** YouTube no monetiza personajes de IA opinando sobre finanzas o salud. Tu voz clonada también cuenta como voz IA. Para esos temas, graba con tu voz real.
- **Actualizaciones:** cuando cambies `index.html` en GitHub, Vercel publica solo. La app instalada toma la nueva versión al abrirla con internet.

## Más adelante: Play Store

Cuando la app esté probada, puedes empaquetarla para Google Play con https://www.pwabuilder.com usando tu URL de Vercel. Necesitas una cuenta de desarrollador de Google Play.
