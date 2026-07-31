import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DirectiveRegistry } from "./ai.js";

function markdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(target) : entry.isFile() && entry.name.endsWith(".md") ? [target] : [];
  });
}

export function loadDirectiveRegistry(root = path.resolve(process.cwd(), "modules")) {
  const files = [
    ...markdownFiles(path.join(root, "radio", "directives")),
    ...markdownFiles(path.join(root, "stars", "directives")),
  ];
  return new DirectiveRegistry(files.map((file) => ({
    source: readFileSync(file, "utf8"),
    name: path.relative(root, file),
  })));
}
