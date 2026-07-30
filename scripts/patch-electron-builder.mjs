#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "node_modules", "app-builder-lib", "out", "node-module-collector", "nodeModulesCollector.js");
const source = readFileSync(target, "utf8");
const vulnerable = "cwd: this.rootDir,\n            shell: true,";
const hardened = "cwd: this.rootDir,\n            shell: false,";
const importAnchor = 'const builder_util_1 = require("builder-util");';
const syncImport = 'const child_process_1 = require("node:child_process");';
const singleAttempt = `        const dependencies = await (0, builder_util_1.exec)(command, args, {
            cwd: this.rootDir,
            shell: false,
        });
        return this.parseDependenciesTree(dependencies);`;
const retried = `        let parseError;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const dependencies = await (0, builder_util_1.exec)(command, args, {
                cwd: this.rootDir,
                shell: false,
            });
            try {
                return this.parseDependenciesTree(dependencies);
            }
            catch (error) {
                parseError = error;
                if (!(error instanceof SyntaxError) || attempt === 2)
                    throw error;
                await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
            }
        }
        throw parseError;`;
const synchronous = `        const dependencies = (0, child_process_1.execFileSync)(command, args, {
            cwd: this.rootDir,
            shell: false,
            encoding: "utf8",
            maxBuffer: 64 * 1024 * 1024,
        });
        return this.parseDependenciesTree(dependencies);`;

let patched = source.includes(vulnerable) ? source.replace(vulnerable, hardened) : source;
if (!patched.includes(syncImport) && patched.includes(importAnchor)) patched = patched.replace(importAnchor, `${importAnchor}\n${syncImport}`);
if (patched.includes(singleAttempt)) patched = patched.replace(singleAttempt, synchronous);
if (patched.includes(retried)) patched = patched.replace(retried, synchronous);
if (patched !== source) {
  writeFileSync(target, patched);
  console.log("Patched electron-builder dependency collection for hardened, complete-output Node child-process semantics.");
} else if (!source.includes(syncImport) || !source.includes(synchronous)) {
  throw new Error("Unsupported electron-builder collector layout; review the compatibility patch.");
}
