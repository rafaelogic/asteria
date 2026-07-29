import os from "node:os";
import path from "node:path";

export function resolveUserPath(environmentName, fallbackSegments, environment = process.env, home = os.homedir()) {
  const configured = environment[environmentName];
  if (configured && path.isAbsolute(configured)) {
    const relativeToSnap = path.relative(path.join(home, "snap"), configured);
    if (relativeToSnap.startsWith("..") || path.isAbsolute(relativeToSnap)) return configured;
  }
  return path.join(home, ...fallbackSegments);
}

export function sanitizedDesktopEnvironment(environment = process.env, home = os.homedir()) {
  const result = { ...environment };
  for (const name of ["XDG_DATA_HOME", "XDG_STATE_HOME", "XDG_CONFIG_HOME"]) {
    const configured = environment[name];
    if (!configured) continue;
    const relativeToSnap = path.relative(path.join(home, "snap"), configured);
    if (!relativeToSnap.startsWith("..") && !path.isAbsolute(relativeToSnap)) delete result[name];
  }
  return result;
}
