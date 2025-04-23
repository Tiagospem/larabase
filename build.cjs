const esbuild = require("esbuild");
const fs = require("fs");

if (!fs.existsSync("dist")) {
  fs.mkdirSync("dist", { recursive: true });
}

const isDev = process.argv.includes("--dev");

const options = {
  platform: "node",
  bundle: true,
  target: "node16",
  external: ["electron", "electron-updater", "electron-store", "cpu-features", "mysql2", "redis"],
  define: {
    "process.env.NODE_ENV": `"${isDev ? "development" : "production"}"`,
    "process.platform": `"${process.platform}"`
  },
  loader: {
    ".node": "file"
  }
};

esbuild.buildSync({
  entryPoints: ["src/main/index.js"],
  outfile: "dist/main.cjs",
  ...options,
  minify: !isDev
});

try {
  esbuild.buildSync({
    entryPoints: ["src/main/preload.js"],
    outfile: "dist/preload.cjs",
    ...options
  });
  console.log("Preload script built successfully");
} catch (error) {
  console.log("No preload script found, skipping");
}

try {
  if (fs.existsSync("src/renderer/assets/icons/png/icon.png")) {
    fs.copyFileSync("src/renderer/assets/icons/png/icon.png", "dist/icon.png");
  }
  if (fs.existsSync("src/renderer/assets/icons/mac/icon.icns")) {
    fs.copyFileSync("src/renderer/assets/icons/mac/icon.icns", "dist/icon.icns");
  }
} catch (error) {
  console.error("Error copying icons:", error.message);
}

console.log(`Build completed in ${isDev ? "development" : "production"} mode`);
