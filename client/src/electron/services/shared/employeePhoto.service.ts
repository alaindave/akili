import { withEmployeeMedia as withPhotos } from "../../storage/employeeMediaLock.js";
import { renameEmployeeDocuments, cleanupEmployeeDocuments } from "./employeeDocumentStorage.service.js";
import fs from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import type Employee from "../../../common/types/hr/employees/Employee.js";
import { getEmployeePhotoDir } from "../../storage/directories.js";
import {
  requireCompanyStorage,
} from "../../storage/companyStorage.js";
import {
  employeePhotoName,
  employeePhotoExtension,
} from "../../storage/employeePhotoName.js";
import {
  getEmployeeById,
  updateEmployee,
  upsertEmployee,
} from "../../database/repositories/modules/hr/employees.repository.js";
import { updateEmployeePhotoMetadata } from "../../database/repositories/modules/hr/employeesPhotos.repository.js";
import {
  photoTransaction,
  listPhotoEmployees,
  renamePhotoReferences,
  saveUploadedPhoto,
  getPhotoCleanup,
  setPhotoCleanup,
} from "../../database/repositories/shared/employeePhotoLayout.repository.js";

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function archiveRoot(): string {
  return path.join(
    path.dirname(getEmployeePhotoDir()),
    "employee_photo_archive"
  );
}

async function stat(file: string) {
  try {
    return await fs.lstat(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Resolve legacy relative paths too, but never traverse links or escape company storage. */
async function photoPath(relative: string): Promise<string> {
  if (
    typeof relative !== "string" ||
    !relative ||
    path.win32.isAbsolute(relative) ||
    path.posix.isAbsolute(relative)
  ) {
    throw new Error("Invalid employee photo path");
  }

  const parts = relative.replace(/\\/g, "/").split("/");

  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error("Invalid employee photo path");
  }

  let result = getEmployeePhotoDir();

  for (const part of ["", ...parts]) {
    result = path.join(result, part);

    if ((await stat(result))?.isSymbolicLink()) {
      throw new Error("Employee photo symlinks are not supported");
    }
  }

  return result;
}

async function archive(bytes: Uint8Array): Promise<string> {
  const root = archiveRoot();

  if ((await stat(root))?.isSymbolicLink()) {
    throw new Error("Employee photo archive cannot be a symlink");
  }

  await fs.mkdir(root, { recursive: true });

  const hash = digest(bytes);
  const destination = path.join(root, hash);

  if ((await stat(destination))?.isSymbolicLink()) {
    throw new Error("Invalid employee photo archive entry");
  }

  try {
    await fs.writeFile(destination, bytes, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }

  if (!(await fs.readFile(destination)).equals(bytes)) {
    throw new Error("Conflicting employee photo archive entry");
  }

  return hash;
}

async function archived(hash: string): Promise<Buffer<ArrayBufferLike>> {
  if (
    !/^[a-f0-9]{64}$/.test(hash) ||
    (await stat(archiveRoot()))?.isSymbolicLink()
  ) {
    throw new Error("Invalid photo archive");
  }

  const file = path.join(archiveRoot(), hash);

  if ((await stat(file))?.isSymbolicLink()) {
    throw new Error("Invalid photo archive entry");
  }

  const bytes = Buffer.from(await fs.readFile(file));

  if (digest(bytes) !== hash) {
    throw new Error("Photo archive hash mismatch");
  }

  return bytes;
}

async function atomicWrite(
  destination: string,
  bytes: Uint8Array
): Promise<void> {
  const temporary = path.join(archiveRoot(), `${randomUUID()}.tmp`);

  await fs.mkdir(archiveRoot(), { recursive: true });

  try {
    await fs.writeFile(temporary, bytes, { flag: "wx" });
    await fs.rename(temporary, destination);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

async function available(employee: Employee, filename: string): Promise<void> {
  const identity = filename.normalize("NFC").toLowerCase();

  for (const other of await listPhotoEmployees(employee.companyId)) {
    if (other._id === employee._id) continue;

    const expected = employeePhotoName(other, path.extname(filename));

    if (
      expected.toLowerCase() === identity ||
      other.photo_path?.normalize("NFC").toLowerCase() === identity
    ) {
      throw new Error(
        `Employee photo filename already belongs to another employee: ${filename}`
      );
    }
  }
}

async function employeeOrThrow(
  companyId: string,
  employeeId: string
): Promise<Employee> {
  const employee = await getEmployeeById(companyId, employeeId);

  if (!employee) throw new Error("Employee not found");

  return employee;
}

async function queueCleanup(source: string, bytes: Uint8Array): Promise<void> {
  const hash = await archive(bytes);
  const entries = await getPhotoCleanup();

  if (
    !entries.some((entry) => entry.source === source && entry.hash === hash)
  ) {
    await setPhotoCleanup([...entries, { source, hash }]);
  }
}

async function cleanup(): Promise<void> {
  for (const entry of await getPhotoCleanup()) {
    const source = await photoPath(entry.source);

    if (!(await stat(source))) continue;

    const bytes = await fs.readFile(source);

    if (digest(bytes) !== entry.hash) continue;

    // A filename may have been reused by a later employee rename.
    await archived(entry.hash);

    const employees = await listPhotoEmployees(
      requireCompanyStorage().companyId
    );

    if (!employees.some((employee) => employee.photo_path === entry.source)) {
      await fs.unlink(source);
    }
  }

  await setPhotoCleanup([]);
}

async function renameCurrent(employee: Employee): Promise<void> {
  if (!employee.photo_path) return;

  const extension =
    path.extname(employee.photo_path) ||
    employeePhotoExtension(employee.photo_mime_type);

  const filename = employeePhotoName(employee, extension);

  await available(employee, filename);

  const source = await photoPath(employee.photo_path);

  if (!(await stat(source))) return;

  // Explicitly normalize both branches to the same Buffer type.
  let bytes: Buffer<ArrayBufferLike> = Buffer.from(await fs.readFile(source));

  if (employee.photo_hash && digest(bytes) !== employee.photo_hash) {
    // Recover a replacement interrupted between the filesystem write and SQLite commit.
    bytes = Buffer.from(await archived(employee.photo_hash));
    await atomicWrite(source, bytes);
  }

  await archive(bytes);

  if (filename !== employee.photo_path) {
    const target = await photoPath(filename);

    if (!(await stat(target))) {
      await fs.copyFile(source, target, constants.COPYFILE_EXCL);
    }

    if (!(await fs.readFile(target)).equals(bytes)) {
      throw new Error(`Conflicting employee photo: ${filename}`);
    }

    await queueCleanup(employee.photo_path, bytes);
  }

  await renamePhotoReferences(employee.companyId, employee._id, filename);
}

/** Startup runs before sync. Archive leftovers, then remove all legacy photo directories. */
export async function migrateEmployeePhotos(): Promise<void> {
  const { companyId } = requireCompanyStorage();

  await withPhotos(companyId, async () => {
    await cleanup();

    await photoTransaction(async () => {
      for (const employee of await listPhotoEmployees(companyId)) {
        await renameCurrent(employee);
      }
    });

    await cleanup();

    const removeLegacy = async (relative: string): Promise<void> => {
      const directory = await photoPath(relative);

      for (const entry of await fs.readdir(directory, {
        withFileTypes: true,
      })) {
        const child = path.posix.join(relative, entry.name);

        if (entry.isDirectory()) {
          await removeLegacy(child);
        } else {
          const source = await photoPath(child);
          const bytes = await fs.readFile(source);

          await archive(bytes);
          await fs.unlink(source);
        }
      }

      await fs.rmdir(directory);
    };

    for (const entry of await fs.readdir(getEmployeePhotoDir(), {
      withFileTypes: true,
    })) {
      if (entry.isSymbolicLink()) {
        throw new Error("Employee photo symlinks are not supported");
      }

      if (entry.isDirectory()) {
        await removeLegacy(entry.name);
      }
    }
  });
}

async function writeTransaction(action: (undo: Array<() => Promise<void>>) => Promise<void>): Promise<void> {
  const undo: Array<() => Promise<void>> = [];
  try { await photoTransaction(() => action(undo)); }
  catch (error) {
    for (const restore of undo.reverse()) await restore();
    throw error;
  }
}

async function install(
  employee: Employee,
  filename: string,
  bytes: Uint8Array,
  persist: () => Promise<void>,
  undo: Array<() => Promise<void>>
): Promise<void> {
  await available(employee, filename);

  const target = await photoPath(filename);
  const oldBytes = (await stat(target)) ? await fs.readFile(target) : null;

  if (oldBytes && employee.photo_path !== filename && !oldBytes.equals(bytes)) {
    throw new Error(`Conflicting employee photo: ${filename}`);
  }

  if (oldBytes) await archive(oldBytes);

  await archive(bytes);
  await atomicWrite(target, bytes);

  undo.push(async () => {
    if (oldBytes) await atomicWrite(target, oldBytes);
    else await fs.rm(target, { force: true });
  });

  try {
    if (employee.photo_path && employee.photo_path !== filename) {
      const previous = await photoPath(employee.photo_path);

      if (await stat(previous)) {
        await queueCleanup(employee.photo_path, await fs.readFile(previous));
      }
    }

    await persist();
  } catch (error) {
    if (oldBytes) {
      await atomicWrite(target, oldBytes);
    } else {
      await fs.unlink(target);
    }

    throw error;
  }
}

export async function uploadEmployeePhoto(
  companyId: string,
  employeeId: string,
  file: { name: string; buffer: Uint8Array }
): Promise<Employee> {
  if (
    !file ||
    typeof file.name !== "string" ||
    !(file.buffer instanceof Uint8Array) ||
    !file.buffer.byteLength
  ) {
    throw new Error("Invalid employee photo upload");
  }

  return withPhotos(companyId, async () => {
    await writeTransaction(async (undo) => {
      const employee = await employeeOrThrow(companyId, employeeId);
      const extension = path.extname(file.name).toLowerCase();
      const filename = employeePhotoName(employee, extension);
      const bytes = Buffer.from(file.buffer);

      const mime =
        extension === ".png"
          ? "image/png"
          : extension === ".webp"
          ? "image/webp"
          : extension === ".gif"
          ? "image/gif"
          : "image/jpeg";

      await install(employee, filename, bytes, () =>
        saveUploadedPhoto(employee, filename, digest(bytes), mime), undo
      );
    });

    await cleanup();

    return employeeOrThrow(companyId, employeeId);
  });
}

export async function installDownloadedPhoto(
  companyId: string,
  employeeId: string,
  bytes: Buffer,
  version: number,
  mimeType: string | null | undefined,
  expectedHash?: string | null,
  modified?: string | null
): Promise<string> {
  return withPhotos(companyId, async () => {
    let filename = "";

    await writeTransaction(async (undo) => {
      const employee = await employeeOrThrow(companyId, employeeId);

      if (
        employee.photo_needs_upload ||
        (employee.photo_version ?? 0) > version
      ) {
        throw new Error(
          "Employee photo changed during download; retry required"
        );
      }

      const photoBytes = Buffer.from(bytes);
      const hash = digest(photoBytes);

      if (!photoBytes.length || (expectedHash && hash !== expectedHash)) {
        throw new Error("Downloaded employee photo hash mismatch");
      }

      const mime = mimeType ?? employee.photo_mime_type;
      filename = employeePhotoName(employee, employeePhotoExtension(mime));

      await install(employee, filename, photoBytes, async () => {
        await updateEmployeePhotoMetadata(companyId, employeeId, {
          photo_path: filename,
          photo_filename: filename,
          photo_version: version,
          photo_hash: hash,
          photo_mime_type: mime,
          photo_last_modified: modified,
        });
      }, undo);
    });

    await cleanup();

    return photoPath(filename);
  });
}

export async function updateEmployeeWithPhoto(
  companyId: string,
  employeeId: string,
  data: Partial<Omit<Employee, "companyId">>
) {
  return withPhotos(companyId, async () => {
    await photoTransaction(async () => {
      await updateEmployee(companyId, employeeId, data);
      const updated = await employeeOrThrow(companyId, employeeId);
      await renameCurrent(updated);
      await renameEmployeeDocuments(updated);
    });

    await cleanup();
    await cleanupEmployeeDocuments();

    return employeeOrThrow(companyId, employeeId);
  });
}

export async function upsertEmployeeWithPhoto(
  employee: Employee
): Promise<void> {
  await withPhotos(employee.companyId, async () => {
    await photoTransaction(async () => {
      await upsertEmployee(employee);

      const updated = await employeeOrThrow(employee.companyId, employee._id);
      await renameCurrent(updated);
      await renameEmployeeDocuments(updated);
    });

    await cleanup();
    await cleanupEmployeeDocuments();
  });
}

export async function readEmployeePhoto(relative: string): Promise<string> {
  return (await fs.readFile(await photoPath(relative))).toString("base64");
}

/** Capture immutable bytes before HTTP; old in-flight snapshots can use the verified archive. */
export async function employeePhotoUploadBytes(
  companyId: string,
  relative: string,
  hash?: string | null
): Promise<Buffer> {
  return withPhotos(companyId, async () => {
    const source = await photoPath(relative);

    if (await stat(source)) {
      const bytes = await fs.readFile(source);

      if (!hash || digest(bytes) === hash) return bytes;
    }

    if (hash) return archived(hash);

    throw new Error("Employee photo file missing; retry required");
  });
}
