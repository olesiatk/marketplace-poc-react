#!/usr/bin/env node
"use strict";

// Generates src/environments/environment.ts from .env before serve/build,
// so the app can read secrets without checking them into source control.
// Runs automatically via npm's "prestart"/"prebuild" hooks.

const fs = require("fs");
const path = require("path");

function parseEnvFile(content) {
  const result = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const rootDir = path.join(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const env = fs.existsSync(envPath) ? parseEnvFile(fs.readFileSync(envPath, "utf8")) : {};

const apiKey = env.GROQ_API_KEY || "";
const model = env.GROQ_MODEL || "openai/gpt-oss-20b";

const outPath = path.join(rootDir, "src", "environments", "environment.ts");
const content = `// Auto-generated from .env by scripts/set-env.js — do not edit by hand.
export const environment = {
  groqApiKey: ${JSON.stringify(apiKey)},
  groqModel: ${JSON.stringify(model)},
};
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, content);
