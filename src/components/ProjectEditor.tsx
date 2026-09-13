"use client";
import { useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { useSystemTheme } from "@/lib/useSystemTheme";
import {
  allFolders,
  deleteFolder,
  ensureFolder,
  fileNameOf,
  folderOf,
  languageForPath,
  normalizePath,
  renameFolder,
  type ProjectFile
} from "@/lib/files";

/**
 * Minimal IDE explorer: explicit directories (create / rename / delete, even
 * when empty) plus files with per-file Monaco + language detection.
 * Select a folder (or its + button) to create files underneath it, like a
 * real IDE; with nothing selected, files go to the project root.
 */
export default function ProjectEditor({
  files,
  folders,
  onChange
}: {
  files: ProjectFile[];
  folders: string[];
  onChange: (files: ProjectFile[], folders: string[]) => void;
}) {
  const [active, setActive] = useState<string>(files[0]?.path ?? "");
  const [addingFile, setAddingFile] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [renamingFile, setRenamingFile] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Folder that new files land in (null = project root). Set by selecting a
  // folder row or via a folder's + button.
  const [targetFolder, setTargetFolder] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const dark = useSystemTheme();

  const activeFile = files.find((f) => f.path === active) ?? files[0] ?? null;
  const tree = useMemo(() => allFolders(files, folders), [files, folders]);

  const set = (f: ProjectFile[], d: string[]) => onChange(f, d);

  const toggleCollapse = (folder: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });

  /** Expands a folder and all its ancestors (used when adding into it). */
  const expandParents = (folder: string) => {
    const parts = folder.split("/").filter(Boolean);
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (let i = 1; i <= parts.length; i++)
        next.delete(parts.slice(0, i).join("/"));
      return next;
    });
  };

  const startAddFile = (base: string | null) => {
    setDraft(base ? `${base}/` : "");
    setAddingFile(true);
  };

  const commitAddFile = () => {
    let path = normalizePath(draft);
    setDraft("");
    setAddingFile(false);
    if (!path) return;
    // Bare names land in the selected folder; explicit paths win as typed.
    if (!path.includes("/") && targetFolder) path = `${targetFolder}/${path}`;
    if (files.some((f) => f.path === path)) {
      setActive(path);
      return;
    }
    const folder = folderOf(path);
    if (folder) expandParents(folder);
    set(
      [...files, { path, content: "" }],
      folder ? ensureFolder(folders, folder) : folders
    );
    setActive(path);
  };

  const commitAddFolder = () => {
    const folder = normalizePath(draft);
    setDraft("");
    setAddingFolder(false);
    if (folder) set(files, ensureFolder(folders, folder));
  };

  const commitRenameFile = () => {
    if (activeFile) {
      const path = normalizePath(draft);
      if (path && !files.some((f) => f.path === path)) {
        const folder = folderOf(path);
        set(
          files.map((f) =>
            f.path === activeFile.path ? { ...f, path } : f
          ),
          folder ? ensureFolder(folders, folder) : folders
        );
        setActive(path);
      }
    }
    setDraft("");
    setRenamingFile(false);
  };

  const commitRenameFolder = (from: string) => {
    const to = normalizePath(draft);
    setDraft("");
    setRenamingFolder(null);
    if (to) {
      const next = renameFolder(files, folders, from, to);
      set(next.files, next.folders);
      if (targetFolder === from) setTargetFolder(to);
      else if (targetFolder?.startsWith(from + "/"))
        setTargetFolder(to + targetFolder.slice(from.length));
    }
  };

  const removeActiveFile = () => {
    if (!activeFile) return;
    const rest = files.filter((f) => f.path !== activeFile.path);
    set(rest, folders);
    setActive(rest[0]?.path ?? "");
  };

  const removeFolder = (target: string) => {
    const next = deleteFolder(files, folders, target);
    if (activeFile && !next.files.some((f) => f.path === activeFile.path)) {
      setActive(next.files[0]?.path ?? "");
    }
    if (targetFolder === target || targetFolder?.startsWith(target + "/"))
      setTargetFolder(null);
    set(next.files, next.folders);
  };

  const updateContent = (content: string) => {
    if (!activeFile) return;
    set(
      files.map((f) =>
        f.path === activeFile.path ? { ...f, content } : f
      ),
      folders
    );
  };

  const totalChars = files.reduce((a, f) => a + f.content.length, 0);
  const inputCls =
    "w-full rounded border bg-white px-2 py-1 font-mono text-xs text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100";

  const fileRow = (f: ProjectFile, marker: string) => (
    <div key={f.path}>
      <button
        onClick={() => setActive(f.path)}
        className={`block w-full truncate px-2 py-1 text-left font-mono text-xs ${f.path === activeFile?.path ? "rounded bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
      >
        {marker} {marker === "•" ? f.path : fileNameOf(f.path)}
      </button>
      {renamingFile && f.path === activeFile?.path && (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRenameFile();
            if (e.key === "Escape") setRenamingFile(false);
          }}
          onBlur={commitRenameFile}
          className={`mt-1 ${inputCls}`}
        />
      )}
    </div>
  );

  const rootFiles = files
    .filter((f) => !folderOf(f.path))
    .sort((a, b) => a.path.localeCompare(b.path));

  return (
    <div className="grid gap-2 md:grid-cols-[280px_1fr]">
      {/* Explorer sidebar */}
      <div className="rounded-md border bg-white p-2 dark:bg-zinc-900">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Explorer
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => {
                setDraft("");
                setAddingFolder(true);
              }}
              title="New folder"
              className="rounded border px-1.5 py-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              + Folder
            </button>
            <button
              onClick={() => startAddFile(targetFolder)}
              title={
                targetFolder
                  ? `New file in ${targetFolder}/ (click a folder to change target, Esc for root)`
                  : "New file (select a folder first to create inside it)"
              }
              className="rounded border px-1.5 py-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              + File
            </button>
          </div>
        </div>
        {addingFolder && (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAddFolder();
              if (e.key === "Escape") setAddingFolder(false);
            }}
            onBlur={commitAddFolder}
            placeholder="New folder e.g. strategy"
            className={`mb-2 ${inputCls}`}
          />
        )}
        {addingFile && (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAddFile();
              if (e.key === "Escape") {
                setAddingFile(false);
                setTargetFolder(null);
              }
            }}
            onBlur={commitAddFile}
            placeholder={
              targetFolder ? `${targetFolder}/Name.java` : "Name.java or folder/Name.java"
            }
            className={`mb-2 ${inputCls}`}
          />
        )}
        {targetFolder && !addingFile && (
          <p className="mb-2 rounded bg-indigo-50 px-2 py-1 text-[11px] text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            New files go to <strong>{targetFolder}/</strong> —{" "}
            <button
              className="underline"
              onClick={() => setTargetFolder(null)}
            >
              use root instead
            </button>
          </p>
        )}
        <div className="max-h-[480px] space-y-2 overflow-auto">
          {rootFiles.map((f) => fileRow(f, "•"))}
          {tree.map((folder) => {
            const inFolder = files
              .filter((f) => folderOf(f.path) === folder)
              .sort((a, b) => a.path.localeCompare(b.path));
            const isCollapsed = collapsed.has(folder);
            return (
              <div key={folder || "(root)"}>
                {folder ? (
                  <div
                    className={`flex items-center justify-between rounded px-1 py-0.5 ${targetFolder === folder ? "bg-indigo-50 dark:bg-indigo-950" : ""}`}
                  >
                    <span className="flex min-w-0 items-center gap-1">
                      <button
                        title={
                          isCollapsed
                            ? `Expand folder ${folder}`
                            : `Collapse folder ${folder}`
                        }
                        aria-label={
                          isCollapsed
                            ? `Expand folder ${folder}`
                            : `Collapse folder ${folder}`
                        }
                        aria-expanded={!isCollapsed}
                        onClick={() => toggleCollapse(folder)}
                        className="w-4 shrink-0 rounded text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      >
                        {isCollapsed ? "▸" : "▾"}
                      </button>
                      <button
                        title="Select as target for new files (click again for root)"
                        onClick={() =>
                          setTargetFolder((t) => (t === folder ? null : folder))
                        }
                        aria-pressed={targetFolder === folder}
                        className={`truncate text-xs font-semibold ${targetFolder === folder ? "text-indigo-700 dark:text-indigo-300" : "text-zinc-500 dark:text-zinc-400"}`}
                      >
                        {folder}/
                        <span className="ml-1 font-normal text-zinc-400 dark:text-zinc-500">
                          ({inFolder.length})
                        </span>
                      </button>
                    </span>
                    <span className="flex gap-1">
                      <button
                        title={`New file in ${folder}/`}
                        onClick={() => {
                          setTargetFolder(folder);
                          startAddFile(folder);
                        }}
                        className="rounded px-1 text-[11px] font-bold text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      >
                        +
                      </button>
                      <button
                        title={`Rename folder ${folder}`}
                        onClick={() => {
                          setDraft(folder);
                          setRenamingFolder(folder);
                        }}
                        className="rounded px-1 text-[11px] text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      >
                        Rename
                      </button>
                      <button
                        title={`Delete folder ${folder} and its contents`}
                        onClick={() => removeFolder(folder)}
                        className="rounded px-1 text-[11px] text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                      >
                        Del
                      </button>
                    </span>
                  </div>
                ) : null}
                {renamingFolder === folder && folder && (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRenameFolder(folder);
                      if (e.key === "Escape") setRenamingFolder(null);
                    }}
                    onBlur={() => commitRenameFolder(folder)}
                    className={`mb-1 ${inputCls}`}
                  />
                )}
                {isCollapsed ? null : (
                  <>
                    {inFolder.map((f) => fileRow(f, "·"))}
                    {folder && inFolder.length === 0 && (
                      <p className="px-4 py-0.5 text-[11px] italic text-zinc-400 dark:text-zinc-500">
                        (empty)
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {tree.length === 0 && rootFiles.length === 0 && (
            <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
              No files — add a file or folder to start.
            </p>
          )}
        </div>
        {activeFile && (
          <div className="mt-2 flex gap-1 border-t pt-2 dark:border-zinc-700">
            <button
              onClick={() => {
                setDraft(activeFile.path);
                setRenamingFile(true);
              }}
              className="rounded border px-1.5 py-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Rename
            </button>
            <button
              onClick={removeActiveFile}
              className="rounded border px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            >
              Delete
            </button>
          </div>
        )}
        <p className="mt-2 px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
          {files.length} file(s) · {tree.length} directorie(s) · {totalChars}{" "}
          chars
        </p>
      </div>

      {/* Editor */}
      <div className="overflow-hidden rounded-md border">
        {activeFile ? (
          <>
            <div className="border-b border-zinc-200 bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {activeFile.path}
              <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                {languageForPath(activeFile.path)}
              </span>
            </div>
            <Editor
              height="600px"
              theme={dark ? "vs-dark" : "light"}
              language={languageForPath(activeFile.path)}
              value={activeFile.content}
              onChange={(v) => updateContent(v ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                scrollBeyondLastLine: false
              }}
            />
          </>
        ) : (
          <div className="flex h-[600px] items-center justify-center bg-white text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
            Select or create a file to start coding.
          </div>
        )}
      </div>
    </div>
  );
}
