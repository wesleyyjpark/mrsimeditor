import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.resolve(__dirname, "assets");

/**
 * Serves files from the project-root `assets/` directory at `/assets/*`
 * during dev, and copies them into the build output during production.
 * This avoids having to relocate the existing assets folder.
 */
function rootAssets(): Plugin {
  return {
    name: "root-assets",
    configureServer(server) {
      server.middlewares.use("/assets", (req, res, next) => {
        if (!req.url) return next();
        const cleanPath = req.url.split("?")[0];
        const filePath = path.join(ASSETS_DIR, cleanPath);
        if (!filePath.startsWith(ASSETS_DIR)) return next();
        fs.stat(filePath, (err, stat) => {
          if (err || !stat.isFile()) return next();
          const stream = fs.createReadStream(filePath);
          stream.on("error", () => next());
          stream.pipe(res);
        });
      });
    },
    async closeBundle() {
      const outDir = path.resolve(__dirname, "dist", "assets");
      await fsp.mkdir(outDir, { recursive: true });
      const files = await fsp.readdir(ASSETS_DIR);
      await Promise.all(
        files.map(async (name) => {
          const src = path.join(ASSETS_DIR, name);
          const dest = path.join(outDir, name);
          const stat = await fsp.stat(src);
          if (stat.isFile()) {
            await fsp.copyFile(src, dest);
          }
        })
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), rootAssets()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    assetsDir: "bundle",
  },
});
