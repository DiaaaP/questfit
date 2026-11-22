import { copyFile, cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = resolve(root, "github-pages-dist");
await mkdir(destination, { recursive: true });
await Promise.all([
  cp(resolve(root, "web"), destination, { recursive: true }),
  cp(resolve(root, "frontend/styles"), resolve(destination, "styles"), { recursive: true }),
  mkdir(resolve(destination, "assets"), { recursive: true }).then(() =>
    copyFile(resolve(root, "frontend/assets/ember-track.jpg"), resolve(destination, "assets/ember-track.jpg"))
  ),
  mkdir(resolve(destination, "public"), { recursive: true }).then(() =>
    copyFile(resolve(root, "public/favicon.svg"), resolve(destination, "public/favicon.svg"))
  ),
]);
