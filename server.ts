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

// Detecta se a execução está ocorrendo sob o runtime tsx (desenvolvimento) ou node nativo (produção)
const isRunningWithTsx = process.execArgv.some((arg) => arg.includes('tsx'));
const isDev = isRunningWithTsx || process.env.npm_lifecycle_event === 'dev';

async function main() {
  // Quando iniciado via 'node server.ts' (produção / build):
  if (!isDev) {
    if (!fs.existsSync(distServer)) {
      try {
        console.log('[Server Launch] ⚙️ Gerando bundle de produção com esbuild...');
        const { buildSync } = await import('esbuild');
        buildSync({
          entryPoints: [path.resolve(__dirname, 'src/server/app.ts')],
          bundle: true,
          platform: 'node',
          format: 'cjs',
          packages: 'external',
          sourcemap: true,
          outfile: distServer,
        });
        console.log('[Server Launch] ✅ Bundle de produção gerado com sucesso.');
      } catch (err) {
        console.warn('[Server Launch] ⚠️ Não foi possível gerar bundle automático via esbuild:', err);
      }
    }

    if (fs.existsSync(distServer)) {
      await import(pathToFileURL(distServer).href);
      return;
    }
  }

  // Modo de desenvolvimento interativo com tsx (HMR e middlewares Vite)
  await import(pathToFileURL(path.resolve(__dirname, 'src/server/app.ts')).href);
}

main().catch((err) => {
  console.error('[Server Launch Error]:', err);
  process.exit(1);
});
