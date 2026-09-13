export interface RunFile {
  path: string;
  content: string;
}

/** Maps file extensions to Piston runtime names. `null` = not runnable. */
const PISTON_BY_EXT: Record<string, string> = {
  java: "java",
  py: "python",
  js: "javascript",
  ts: "typescript",
  go: "go",
  c: "c",
  h: "c++",
  cpp: "c++",
  cc: "c++",
  cxx: "c++",
  rs: "rust",
  rb: "ruby",
  php: "php",
  kt: "kotlin",
  kts: "kotlin",
  cs: "csharp",
  swift: "swift",
  scala: "scala",
  sh: "bash"
};

export const SUPPORTED_RUN_EXTENSIONS = Object.keys(PISTON_BY_EXT).sort();

export function pistonLanguageForPath(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return PISTON_BY_EXT[ext] ?? null;
}

export const MAX_RUN_FILES = 20;
export const MAX_RUN_TOTAL_CHARS = 100_000;
export const MAX_STDIN_CHARS = 20_000;

/** Returns an error message when the run request is invalid, else null. */
export function validateRunInput(
  files: RunFile[],
  stdin: string
): string | null {
  if (files.length === 0) return "No files to run.";
  if (files.length > MAX_RUN_FILES)
    return `Too many files (max ${MAX_RUN_FILES}).`;
  const total = files.reduce((a, f) => a + f.content.length, 0);
  if (total > MAX_RUN_TOTAL_CHARS)
    return `Project too large to run (max ${MAX_RUN_TOTAL_CHARS} chars).`;
  if (stdin.length > MAX_STDIN_CHARS)
    return `Stdin too large (max ${MAX_STDIN_CHARS} chars).`;
  return null;
}
