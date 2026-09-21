import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { requireUser, ApiError } from "@/lib/server/auth";
import { getServerForUser } from "@/lib/server/access";
import { ok, fail, handleApi } from "@/lib/server/http";
import { serverDataDir, safeResolve } from "@/lib/minecraft/mock-provider";
import { logAudit } from "@/lib/server/platform";

type Ctx = { params: Promise<{ id: string }> };

const MAX_TEXT_BYTES = 2 * 1024 * 1024; // 2MB editable text limit
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB upload limit
const PROTECTED_ROOT_FILES = new Set(["eula.txt"]);

function listDirectory(baseDir: string, relPath: string) {
  const target = safeResolve(baseDir, relPath);
  const entries = fs.readdirSync(target, { withFileTypes: true });
  return entries
    .map((entry) => {
      const full = path.join(target, entry.name);
      const stat = fs.statSync(full);
      return {
        name: entry.name,
        path: path.posix.join(relPath || "", entry.name),
        type: entry.isDirectory() ? "directory" : "file",
        size: entry.isDirectory() ? 0 : stat.size,
        modifiedAt: stat.mtime,
      };
    })
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1));
}

export async function GET(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const baseDir = serverDataDir(id);
    const { searchParams } = new URL(req.url);
    const download = searchParams.get("download");
    const readPath = searchParams.get("read");
    const dirPath = searchParams.get("path") ?? "";

    if (download) {
      const target = safeResolve(baseDir, download);
      if (!fs.existsSync(target)) throw new ApiError(404, "File not found.");
      const stat = fs.statSync(target);
      if (stat.isDirectory()) throw new ApiError(400, "Use the compress action to download a folder.");
      const buffer = fs.readFileSync(target);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${path.basename(target)}"`,
          "Content-Length": String(stat.size),
        },
      });
    }

    if (readPath) {
      const target = safeResolve(baseDir, readPath);
      const stat = fs.statSync(target);
      if (stat.isDirectory()) throw new ApiError(400, "Cannot read a directory as a file.");
      if (stat.size > MAX_TEXT_BYTES) throw new ApiError(413, "File is too large to edit in the browser.");
      const content = fs.readFileSync(target, "utf-8");
      return ok({ path: readPath, content, size: stat.size });
    }

    const target = safeResolve(baseDir, dirPath);
    if (!fs.existsSync(target)) throw new ApiError(404, "Directory not found.");
    return ok({ path: dirPath, entries: listDirectory(baseDir, dirPath) });
  });
}

export async function POST(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const server = await getServerForUser(user, id);
    const baseDir = serverDataDir(id);
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const dirPath = String(form.get("path") ?? "");
      const file = form.get("file");
      if (!(file instanceof File)) return fail(400, "No file provided.");
      if (file.size > MAX_UPLOAD_BYTES) return fail(413, "File exceeds the 100MB upload limit.");
      const dest = safeResolve(baseDir, path.posix.join(dirPath, file.name));
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(dest, buffer);
      await logAudit({ userId: user.id, serverId: id, action: "FILE_UPLOADED", metadata: { path: dest.replace(baseDir, "") } });
      return ok({ success: true });
    }

    const body = await req.json().catch(() => ({}));
    const { op } = body as { op?: string };

    if (op === "create") {
      const { targetPath, type } = body as { targetPath: string; type: "file" | "directory" };
      const dest = safeResolve(baseDir, targetPath);
      if (fs.existsSync(dest)) return fail(409, "A file or folder already exists at that path.");
      if (type === "directory") fs.mkdirSync(dest, { recursive: true });
      else fs.writeFileSync(dest, "");
      await logAudit({ userId: user.id, serverId: id, action: "FILE_CREATED", metadata: { path: targetPath, type } });
      return ok({ success: true });
    }

    if (op === "write") {
      const { targetPath, content } = body as { targetPath: string; content: string };
      const dest = safeResolve(baseDir, targetPath);
      if (fs.existsSync(dest) && fs.statSync(dest).isDirectory()) return fail(400, "Cannot write content to a directory.");
      fs.writeFileSync(dest, content ?? "");
      await logAudit({ userId: user.id, serverId: id, action: "FILE_EDITED", metadata: { path: targetPath } });
      return ok({ success: true });
    }

    if (op === "rename" || op === "move") {
      const { from, to } = body as { from: string; to: string };
      const src = safeResolve(baseDir, from);
      const dest = safeResolve(baseDir, to);
      if (!fs.existsSync(src)) return fail(404, "Source not found.");
      if (fs.existsSync(dest)) return fail(409, "Destination already exists.");
      fs.renameSync(src, dest);
      await logAudit({ userId: user.id, serverId: id, action: "FILE_MOVED", metadata: { from, to } });
      return ok({ success: true });
    }

    if (op === "compress") {
      const { paths, destPath } = body as { paths: string[]; destPath: string };
      const dest = safeResolve(baseDir, destPath);
      const zip = new AdmZip();
      for (const p of paths) {
        const src = safeResolve(baseDir, p);
        const stat = fs.statSync(src);
        if (stat.isDirectory()) zip.addLocalFolder(src, path.basename(src));
        else zip.addLocalFile(src);
      }
      zip.writeZip(dest);
      await logAudit({ userId: user.id, serverId: id, action: "FILES_COMPRESSED", metadata: { paths, destPath } });
      return ok({ success: true });
    }

    if (op === "extract") {
      const { targetPath, destPath } = body as { targetPath: string; destPath: string };
      const src = safeResolve(baseDir, targetPath);
      const dest = safeResolve(baseDir, destPath);
      fs.mkdirSync(dest, { recursive: true });
      const zip = new AdmZip(src);
      for (const entry of zip.getEntries()) {
        safeResolve(dest, entry.entryName); // throws on zip-slip attempts
      }
      zip.extractAllTo(dest, true);
      await logAudit({ userId: user.id, serverId: id, action: "FILES_EXTRACTED", metadata: { targetPath, destPath } });
      return ok({ success: true });
    }

    void server;
    return fail(400, "Unknown file operation.");
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const baseDir = serverDataDir(id);
    const { searchParams } = new URL(req.url);
    const targetPath = searchParams.get("path");
    if (!targetPath) return fail(400, "Missing path.");
    if (PROTECTED_ROOT_FILES.has(targetPath)) return fail(400, "This file is required by the server and cannot be deleted.");

    const target = safeResolve(baseDir, targetPath);
    if (!fs.existsSync(target)) return fail(404, "File not found.");
    fs.rmSync(target, { recursive: true, force: true });
    await logAudit({ userId: user.id, serverId: id, action: "FILE_DELETED", metadata: { path: targetPath } });
    return ok({ success: true });
  });
}
