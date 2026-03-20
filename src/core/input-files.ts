import { mkdirSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import type { IncomingFile } from "../types/solve.js";

export type PreparedInputFile = {
  filename: string;
  mime_type: string;
  path: string;
  is_image: boolean;
};

export function prepareInputFiles(input: {
  runId: string;
  files?: IncomingFile[];
}): PreparedInputFile[] {
  const files = input.files ?? [];
  if (files.length === 0) {
    return [];
  }

  const directory = resolve(
    process.cwd(),
    ".solve-logs",
    "runs",
    input.runId,
    "input-files",
  );
  mkdirSync(directory, { recursive: true });

  return files.map((file, index) => {
    const safeFilename = toSafeFilename(file.filename, index);
    const path = resolve(directory, safeFilename);
    writeFileSync(path, Buffer.from(file.content_base64, "base64"));

    return {
      filename: file.filename,
      mime_type: file.mime_type,
      path,
      is_image: file.mime_type.startsWith("image/"),
    };
  });
}

function toSafeFilename(filename: string, index: number): string {
  const original = basename(filename);
  const extension = extname(original);
  const stem = extension ? original.slice(0, -extension.length) : original;
  const normalizedStem = stem.replace(/[^a-zA-Z0-9._-]+/g, "_") || `file_${index}`;
  return `${String(index + 1).padStart(2, "0")}_${normalizedStem}${extension}`;
}
