export interface ProjectFile {
  path: string;
  content: string;
}

const LANG_BY_EXT: Record<string, string> = {
  java: "java",
  py: "python",
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  kt: "kotlin",
  cs: "csharp",
  cpp: "cpp",
  h: "cpp",
  c: "c",
  go: "go",
  rb: "ruby",
  php: "php",
  rs: "rust",
  swift: "swift",
  sql: "sql",
  xml: "xml",
  md: "markdown",
  json: "json"
};

export function languageForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANG_BY_EXT[ext] ?? "plaintext";
}

/** Serialize the whole mini-project into one reviewable payload. */
export function joinFiles(files: ProjectFile[], folders: string[] = []): string {
  if (files.length === 0 && folders.length === 0)
    return "(no files — the candidate wrote no code)";
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const tree = allFolders(sorted, folders);
  const emptyDirs = tree.filter(
    (d) =>
      !sorted.some(
        (f) => folderOf(f.path) === d || folderOf(f.path).startsWith(d + "/")
      )
  );
  const parts = sorted.map(
    (f) => `===== FILE: ${f.path} =====\n${f.content}`
  );
  const listing = [
    ...tree.map((d) => `- ${d}/`),
    ...sorted.map((f) => `- ${f.path}`)
  ].join("\n");
  const emptyNote =
    emptyDirs.length > 0
      ? `\n(empty directories: ${emptyDirs.map((d) => `${d}/`).join(", ")})`
      : "";
  return `Project (${sorted.length} file(s), ${tree.length} directorie(s)):\n${listing}${emptyNote}\n\n${parts.join("\n\n")}`;
}

/** Folders derived from paths, e.g. "model/Ticket.java" -> "model". */
export function folderOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function fileNameOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

/** Normalizes a file or folder path: trims, collapses slashes, no lead/trail. */
export function normalizePath(raw: string): string {
  return raw
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

/** Adds an explicit (possibly empty) directory; idempotent. */
export function ensureFolder(folders: string[], folder: string): string[] {
  const f = normalizePath(folder);
  if (!f || folders.includes(f)) return folders;
  return [...folders, f].sort();
}

/**
 * Every directory to display: explicit ones plus each ancestor implied by
 * file paths (e.g. `a/b/C.java` implies `a` and `a/b`).
 */
export function allFolders(files: ProjectFile[], extra: string[]): string[] {
  const set = new Set<string>();
  const addWithParents = (dir: string) => {
    const parts = dir.split("/").filter(Boolean);
    for (let i = 1; i <= parts.length; i++)
      set.add(parts.slice(0, i).join("/"));
  };
  for (const f of files) {
    const folder = folderOf(f.path);
    if (folder) addWithParents(folder);
  }
  for (const e of extra) {
    const p = normalizePath(e);
    if (p) addWithParents(p);
  }
  return [...set].sort();
}

/** Renames a directory: rewrites file prefixes + explicit entries. */
export function renameFolder(
  files: ProjectFile[],
  folders: string[],
  from: string,
  to: string
): { files: ProjectFile[]; folders: string[] } {
  const src = normalizePath(from);
  const dst = normalizePath(to);
  if (!src || !dst || src === dst) return { files, folders };
  if (dst.startsWith(src + "/")) return { files, folders }; // into itself
  if (
    folders.includes(dst) ||
    files.some((f) => f.path === dst || f.path.startsWith(dst + "/"))
  )
    return { files, folders }; // target already occupied
  const mapped = files.map((f) =>
    f.path === src || f.path.startsWith(src + "/")
      ? { ...f, path: dst + f.path.slice(src.length) }
      : f
  );
  const mappedFolders = folders.map((d) =>
    d === src ? dst : d.startsWith(src + "/") ? dst + d.slice(src.length) : d
  );
  return { files: mapped, folders: ensureFolder(mappedFolders, dst) };
}

/** Deletes a directory with everything under it (files + subdirectories). */
export function deleteFolder(
  files: ProjectFile[],
  folders: string[],
  target: string
): { files: ProjectFile[]; folders: string[] } {
  const t = normalizePath(target);
  if (!t) return { files, folders };
  return {
    files: files.filter(
      (f) => !(f.path === t || f.path.startsWith(t + "/"))
    ),
    folders: folders.filter(
      (d) => !(d === t || d.startsWith(t + "/"))
    )
  };
}
