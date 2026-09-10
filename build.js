const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = __dirname;
const clientDir = path.join(rootDir, "client");

console.log("[BUILD] Installing client dependencies...");
execSync("npm install", { cwd: clientDir, stdio: "inherit" });

console.log("[BUILD] Building client with Vite...");
execSync("npm run build", { cwd: clientDir, stdio: "inherit" });

const clientDist = path.join(clientDir, "dist");
const rootDist = path.join(rootDir, "dist");

if (fs.existsSync(clientDist)) {
  console.log("[BUILD] Syncing dist to root directory...");
  fs.cpSync(clientDist, rootDist, { recursive: true, force: true });
}

console.log("[BUILD] Build succeeded!");
