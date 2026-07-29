import { rmSync } from "node:fs";
import path from "node:path";

const allowed = new Set(["dist", "dist-electron"]);
const requested = process.argv[2];
if (!requested || !allowed.has(requested)) throw new Error("Refusing to clean an unapproved output directory.");
rmSync(path.join(process.cwd(), requested), { recursive: true, force: true });
