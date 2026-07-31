import { createHash, randomUUID } from "node:crypto";
import { open, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { RaDioChatAttachment } from "../../../src/types.js";

const allowed = new Set([".txt", ".md", ".mdx", ".json", ".jsonl", ".log", ".csv", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".scss", ".html", ".xml", ".yaml", ".yml", ".toml", ".sql", ".sh", ".py", ".go", ".rs", ".java", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const mime: Record<string, string> = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".md": "text/markdown", ".json": "application/json" };
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

async function digest(filePath: string) {
  const handle = await open(filePath, "r");
  const hash = createHash("sha256");
  const buffer = Buffer.alloc(64 * 1024);
  try {
    let position = 0;
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (!bytesRead) break;
      hash.update(buffer.subarray(0, bytesRead)); position += bytesRead;
    }
  } finally { await handle.close(); }
  return hash.digest("hex");
}

export async function inspectAttachment(inputPath: string): Promise<RaDioChatAttachment> {
  const resolved = await realpath(inputPath);
  const metadata = await stat(resolved);
  const extension = path.extname(resolved).toLowerCase();
  if (!metadata.isFile() || !allowed.has(extension) || metadata.size > MAX_ATTACHMENT_BYTES) {
    return { id: randomUUID(), name: path.basename(resolved), path: resolved, mime: "application/octet-stream", size: metadata.size, modifiedAt: metadata.mtime.toISOString(), digest: "", status: "rejected" };
  }
  return { id: randomUUID(), name: path.basename(resolved), path: resolved, mime: mime[extension] ?? (extension.match(/\.(png|jpg|jpeg|gif|webp)$/) ? `image/${extension.slice(1)}` : "text/plain"), size: metadata.size, modifiedAt: metadata.mtime.toISOString(), digest: await digest(resolved), status: "ready" };
}

export async function revalidateAttachment(attachment: RaDioChatAttachment) {
  try {
    const current = await inspectAttachment(attachment.path);
    return { ...attachment, status: current.status === "rejected" ? "rejected" as const : current.digest === attachment.digest && current.modifiedAt === attachment.modifiedAt ? "ready" as const : "stale" as const };
  } catch {
    return { ...attachment, status: "missing" as const };
  }
}
