"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch, deleteJson, postJson, ClientApiError } from "@/lib/client/api";
import { Button, ConfirmDialog, EmptyState, Input, Modal, Skeleton } from "@/components/ui";
import {
  ChevronRight, Download, File as FileIcon, Folder, FolderPlus, PackagePlus, Pencil, Trash2, Upload, Archive, FolderOpen,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { toast } from "sonner";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> });

type Entry = { name: string; path: string; type: "file" | "directory"; size: number; modifiedAt: string };

function languageFor(name: string): string {
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".properties") || name.endsWith(".txt") || name === "eula.txt") return "ini";
  if (name.endsWith(".yml") || name.endsWith(".yaml")) return "yaml";
  if (name.endsWith(".log")) return "log";
  return "plaintext";
}

export function FileManager({ serverId }: { serverId: string }) {
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ path: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [createModal, setCreateModal] = useState<"file" | "directory" | null>(null);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<Entry | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (dir: string) => {
    setLoading(true);
    try {
      const res = await apiFetch<{ path: string; entries: Entry[] }>(`/api/servers/${serverId}/files?path=${encodeURIComponent(dir)}`);
      setEntries(res.entries);
      setPath(res.path);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to load directory.");
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => { load(""); }, [load]);

  const crumbs = ["root", ...path.split("/").filter(Boolean)];

  async function openFile(entry: Entry) {
    try {
      const res = await apiFetch<{ content: string }>(`/api/servers/${serverId}/files?read=${encodeURIComponent(entry.path)}`);
      setEditing({ path: entry.path, content: res.content });
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Unable to open this file (it may be too large or binary).");
    }
  }

  async function saveFile() {
    if (!editing) return;
    setSaving(true);
    try {
      await postJson(`/api/servers/${serverId}/files`, { op: "write", targetPath: editing.path, content: editing.content });
      toast.success("File saved.");
      setEditing(null);
      load(path);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to save file.");
    } finally {
      setSaving(false);
    }
  }

  async function createEntry() {
    if (!createModal || !newName.trim()) return;
    try {
      await postJson(`/api/servers/${serverId}/files`, { op: "create", targetPath: `${path ? path + "/" : ""}${newName.trim()}`, type: createModal });
      toast.success(`${createModal === "directory" ? "Folder" : "File"} created.`);
      setCreateModal(null);
      setNewName("");
      load(path);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to create.");
    }
  }

  async function submitRename() {
    if (!renaming || !renameValue.trim()) return;
    const to = path ? `${path}/${renameValue.trim()}` : renameValue.trim();
    try {
      await postJson(`/api/servers/${serverId}/files`, { op: "rename", from: renaming.path, to });
      toast.success("Renamed.");
      setRenaming(null);
      load(path);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to rename.");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteJson(`/api/servers/${serverId}/files?path=${encodeURIComponent(deleting.path)}`);
      toast.success("Deleted.");
      setDeleting(null);
      load(path);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to delete.");
    }
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const form = new FormData();
    form.append("path", path);
    form.append("file", fileList[0]);
    try {
      const res = await fetch(`/api/servers/${serverId}/files`, { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Upload failed");
      toast.success("File uploaded.");
      load(path);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  async function extractZip(entry: Entry) {
    const destPath = entry.path.replace(/\.zip$/i, "");
    try {
      await postJson(`/api/servers/${serverId}/files`, { op: "extract", targetPath: entry.path, destPath });
      toast.success("Archive extracted.");
      load(path);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to extract archive.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 text-sm text-slate-400">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
              <button className="hover:text-emerald-400" onClick={() => load(crumbs.slice(1, i + 1).join("/"))}>{c}</button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleUpload(e.target.files)} />
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Upload</Button>
          <Button size="sm" variant="outline" onClick={() => setCreateModal("file")}><PackagePlus className="h-3.5 w-3.5" /> New File</Button>
          <Button size="sm" variant="outline" onClick={() => setCreateModal("directory")}><FolderPlus className="h-3.5 w-3.5" /> New Folder</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : entries.length === 0 ? (
        <EmptyState icon={<FolderOpen className="h-8 w-8 text-slate-600" />} title="This folder is empty" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/60 text-left text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Size</th><th className="px-4 py-2">Modified</th><th className="px-4 py-2 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {entries.map((entry) => (
                <tr key={entry.path} className="hover:bg-slate-900/40">
                  <td className="px-4 py-2">
                    <button
                      className="flex items-center gap-2 text-slate-200 hover:text-emerald-400"
                      onClick={() => (entry.type === "directory" ? load(entry.path) : openFile(entry))}
                    >
                      {entry.type === "directory" ? <Folder className="h-4 w-4 text-emerald-400" /> : <FileIcon className="h-4 w-4 text-slate-500" />}
                      {entry.name}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{entry.type === "file" ? formatBytes(entry.size) : "—"}</td>
                  <td className="px-4 py-2 text-slate-500">{new Date(entry.modifiedAt).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      {entry.type === "file" && entry.name.endsWith(".zip") && (
                        <Button size="sm" variant="ghost" onClick={() => extractZip(entry)} title="Extract"><Archive className="h-3.5 w-3.5" /></Button>
                      )}
                      {entry.type === "file" && (
                        <Button size="sm" variant="ghost" onClick={() => window.open(`/api/servers/${serverId}/files?download=${encodeURIComponent(entry.path)}`, "_blank")} title="Download">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { setRenaming(entry); setRenameValue(entry.name); }} title="Rename"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(entry)} title="Delete"><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.path ?? ""} footer={<Button onClick={saveFile} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>}>
        {editing && (
          <div className="h-96 overflow-hidden rounded-lg border border-slate-800">
            <MonacoEditor
              height="100%"
              theme="vs-dark"
              language={languageFor(editing.path)}
              value={editing.content}
              onChange={(v) => setEditing((prev) => (prev ? { ...prev, content: v ?? "" } : prev))}
              options={{ minimap: { enabled: false }, fontSize: 13 }}
            />
          </div>
        )}
      </Modal>

      <Modal open={!!createModal} onClose={() => setCreateModal(null)} title={createModal === "directory" ? "New Folder" : "New File"} footer={<Button onClick={createEntry}>Create</Button>}>
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={createModal === "directory" ? "folder-name" : "file.txt"} autoFocus />
      </Modal>

      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Rename" footer={<Button onClick={submitRename}>Rename</Button>}>
        <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={`Delete ${deleting?.name}?`}
        description={`This will permanently delete ${deleting?.type === "directory" ? "this folder and all of its contents" : "this file"}. This action cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
