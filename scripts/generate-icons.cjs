const { app, nativeImage } = require("electron");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
const source = path.resolve(__dirname, "../build/icon.png");

app.whenReady().then(() => {
  const icon = nativeImage.createFromPath(source);
  if (icon.isEmpty()) throw new Error(`Unable to load ${source}`);
  for (const size of sizes) {
    const directory = path.resolve(__dirname, `../build/icons/${size}x${size}/apps`);
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, "asteria.png"), icon.resize({ width: size, height: size, quality: "best" }).toPNG());
  }
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
