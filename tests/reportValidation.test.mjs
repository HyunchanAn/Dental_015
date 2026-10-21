import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const VALID_FDI_NUMBERS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18,
  21, 22, 23, 24, 25, 26, 27, 28,
  31, 32, 33, 34, 35, 36, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48,
]);

test("mockFinalReport.ts has valid SHA-256 hex digest matching public/sample_panorama.png", () => {
  const mockSource = fs.readFileSync(
    path.join(repoRoot, "src", "mocks", "mockFinalReport.ts"),
    "utf8"
  );
  const hashMatch = mockSource.match(/sha256_hash:\s*"([0-9a-f]{64})"/);
  assert.ok(hashMatch, "sha256_hash must be a 64-character lowercase hex string");

  const sampleImgPath = path.join(repoRoot, "public", "sample_panorama.png");
  assert.ok(fs.existsSync(sampleImgPath), "public/sample_panorama.png must exist");

  const imgBuffer = fs.readFileSync(sampleImgPath);
  const actualSha256 = crypto.createHash("sha256").update(imgBuffer).digest("hex");
  assert.equal(hashMatch[1], actualSha256);
});

test("mockFinalReport tooth numbers are within valid adult FDI range (11-48) and coordinates are normalized", () => {
  const mockSource = fs.readFileSync(
    path.join(repoRoot, "src", "mocks", "mockFinalReport.ts"),
    "utf8"
  );

  const toothMatches = [...mockSource.matchAll(/toothNumber:\s*(\d+)/g)];
  assert.ok(toothMatches.length >= 5, "Expected at least 5 toothNumber entries in mockFinalReport");

  for (const m of toothMatches) {
    const fdi = Number(m[1]);
    assert.ok(
      VALID_FDI_NUMBERS.has(fdi),
      `FDI number ${fdi} is outside valid permanent dentition range (11-48)`
    );
  }

  const coordMatches = [...mockSource.matchAll(/\b[xywh]:\s*([0-9.]+)/g)];
  assert.ok(coordMatches.length > 0, "Expected normalized bounding-box coordinates");
  for (const cm of coordMatches) {
    const val = Number(cm[1]);
    assert.ok(val >= 0.0 && val <= 1.0, `Normalized coordinate ${val} must be in [0.0, 1.0]`);
  }
});
