/**
 * Servidor Oficial Khedira League 2027
 * Ponto de entrada robusto compatível com ambientes de desenvolvimento (tsx)
 * e ambientes de produção conteinerizados (Docker / Render / Railway / Node 22+ e Node 24+).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distServer = path.resolve(__dirname, 'dist', 'server.cjs');

async function main() {
  if (process.env.NODE_ENV === 'production' && fs.existsSync(distServer)) {
    await import(pathToFileURL(distServer).href);
    return;
  }

  // Modo de desenvolvimento interativo (TypeScript nativo com tsx)
  await import(pathToFileURL(path.resolve(__dirname, 'src/server/app.ts')).href);
}

main().catch((err) => {
  console.error('[Server Launch Error]:', err);
  process.exit(1);
});
