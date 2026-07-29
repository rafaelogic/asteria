#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "node_modules", "app-builder-lib", "out", "node-module-collector", "nodeModulesCollector.js");
const source = readFileSync(target, "utf8");
const vulnerable = "cwd: this.rootDir,\n            shell: true,";
const hardened = "cwd: this.rootDir,\n            shell: false,";

if (source.includes(vulnerable)) {
  writeFileSync(target, source.replace(vulnerable, hardened));
  console.log("Patched electron-builder dependency collection for hardened Node child-process semantics.");
} else if (!source.includes(hardened)) {
  throw new Error("Unsupported electron-builder collector layout; review the compatibility patch.");
}
