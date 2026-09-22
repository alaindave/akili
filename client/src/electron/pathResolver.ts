import path from "path";
import { app } from "electron";
import { isDev } from "./util/env.util.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getPreloadPath() {
  return path.join(__dirname, "preload/index.cjs");
}

export function getUIPath() {
  return path.join(app.getAppPath(), "/dist-react/index.html");
}

export function getAssetPath() {
  return path.join(app.getAppPath(), isDev() ? "." : "..", "/src/assets");
}
