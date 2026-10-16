import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { getCompanyFilesRoot, requireCompanyStorage } from "../../storage/companyStorage.js";
import { getMediaLayoutMigration, migrateMediaLayoutPaths, finishMediaLayoutCleanup,
  type MediaMove } from "../../database/repositories/shared/mediaLayout.repository.js";

async function exists(file: string): Promise<boolean> {
  try { await fs.lstat(file); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}

/** Copy first, commit paths and the cleanup journal together, then remove verified originals. */
export async function migrateMediaLayout(): Promise<void> {
  const root = getCompanyFilesRoot();
  const { companyId } = requireCompanyStorage();
  let moves = await getMediaLayoutMigration();
  if (moves !== null && moves.length === 0) return;
  const resolve = (relative: string) => {
    const result = path.resolve(root, relative);
    const suffix = path.relative(root, result);
    if (!suffix || suffix.startsWith("..") || path.isAbsolute(suffix)) throw new Error("Invalid media migration path");
    return result;
  };
  if (moves === null) {
    const pending: MediaMove[] = [];
    const collect = async (source: string, target: string): Promise<void> => {
      // Finder metadata is unrelated to media and can differ between folders.
      if (path.basename(source) === ".DS_Store") return;
      if (!await exists(resolve(source))) return;
      const stat = await fs.lstat(resolve(source));
      if (stat.isSymbolicLink()) throw new Error(`Cannot migrate media symlink: ${source}`);
      if (stat.isDirectory()) {
        for (const name of await fs.readdir(resolve(source))) await collect(path.join(source, name), path.join(target, name));
      } else if (stat.isFile()) pending.push({ source, target });
    };
    for (const kind of ["company_logo", "employees_documents", "employees_photos"]) {
      if ((await fs.lstat(path.join(root, kind))).isSymbolicLink()) throw new Error(`Cannot migrate media symlink: ${kind}`);
      await collect(path.join(kind, companyId), kind);
    }
    moves = pending;
    for (const move of moves) {
      const source = resolve(move.source);
      const target = resolve(move.target);
      // Check every destination ancestor, including existing employee folders.
      for (let dir = target; dir !== root; dir = path.dirname(dir)) {
        if (await exists(dir) && (await fs.lstat(dir)).isSymbolicLink()) throw new Error(`Cannot migrate media symlink: ${dir}`);
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      if (!await exists(target)) await fs.copyFile(source, target, constants.COPYFILE_EXCL);
      if (!(await fs.readFile(source)).equals(await fs.readFile(target))) throw new Error(`Conflicting media files: ${source} and ${target}`);
    }
    await migrateMediaLayoutPaths(companyId, moves);
  }
  for (const move of moves) {
    // Older migration journals may include Finder metadata.
    if (path.basename(move.source) === ".DS_Store") continue;
    const source = resolve(move.source);
    if (await exists(source)) {
      const target = resolve(move.target);
      if (!(await fs.readFile(source)).equals(await fs.readFile(target))) throw new Error(`Media changed before cleanup: ${source}`);
      await fs.unlink(source);
    }
  }
  // Remove only empty legacy directories, preserving any new files after an interrupted run.
  const removeEmpty = async (directory: string): Promise<void> => {
    if (!await exists(directory)) return;
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return;
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) await removeEmpty(path.join(directory, entry.name));
    }
    try { await fs.rmdir(directory); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOTEMPTY") throw error; }
  };
  for (const kind of ["company_logo", "employees_documents", "employees_photos"]) {
    await removeEmpty(path.join(root, kind, companyId));
  }
  await finishMediaLayoutCleanup();
}
