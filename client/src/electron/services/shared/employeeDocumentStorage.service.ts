import fs from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import type Employee from "../../../common/types/hr/employees/Employee.js";
import type {
  EmployeeDocument,
  UploadedEmployeeDocument,
} from "../../../common/types/hr/employees/EmployeeDocuments.js";
import { getEmployeeDocumentsDir } from "../../storage/directories.js";
import { requireCompanyStorage } from "../../storage/companyStorage.js";
import { withEmployeeMedia } from "../../storage/employeeMediaLock.js";
import { employeePhotoName } from "../../storage/employeePhotoName.js";
import { getEmployeeById } from "../../database/repositories/modules/hr/employees.repository.js";
import {
  getEmployeeDocument,
  getEmployeeDocumentById,
  upsertEmployeeDocument,
  updateEmployeeDocument,
  deleteEmployeeDocument,
  applyEmployeeDocumentDeletion,
} from "../../database/repositories/modules/hr/employeesDocuments.repository.js";
import {
  documentTransaction,
  listDocumentEmployees,
  listLayoutDocuments,
  renameDocumentReferences,
  getDocumentCleanup,
  setDocumentCleanup,
} from "../../database/repositories/shared/employeeDocumentLayout.repository.js";

function toSafeBuffer(bytes: Uint8Array): Buffer<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return Buffer.from(copy.buffer);
}

export function employeeDocumentFolder(employee: Employee): string {
  return employeePhotoName(employee, ".jpg").slice(0, -4) + "_documents";
}

function documentName(type: string, original: string): string {
  if (typeof type !== "string" || !type.trim()) {
    throw new Error("Document type is required");
  }

  const extension = path.extname(original).toLowerCase();

  if (!/^\.[a-z0-9]{1,12}$/.test(extension)) {
    throw new Error("Document requires a valid file extension");
  }

  const name =
    type
      .normalize("NFC")
      .trim()
      .replace(/[^\p{L}\p{N}_-]+/gu, "_") + extension;

  if (Buffer.byteLength(name) > 240) {
    throw new Error("Document filename is too long");
  }

  return name;
}

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function archiveRoot(): string {
  return path.join(
    path.dirname(getEmployeeDocumentsDir()),
    "employee_document_archive"
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

async function documentPath(relative: string): Promise<string> {
  if (
    typeof relative !== "string" ||
    !relative ||
    path.posix.isAbsolute(relative) ||
    path.win32.isAbsolute(relative)
  ) {
    throw new Error("Invalid document path");
  }

  const parts = relative.replace(/\\/g, "/").split("/");

  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error("Invalid document path");
  }

  let result = getEmployeeDocumentsDir();

  for (const part of ["", ...parts]) {
    result = path.join(result, part);

    if ((await stat(result))?.isSymbolicLink()) {
      throw new Error("Document symlinks are not supported");
    }
  }

  return result;
}

async function archive(bytes: Uint8Array): Promise<string> {
  const root = archiveRoot();

  if ((await stat(root))?.isSymbolicLink()) {
    throw new Error("Invalid document archive");
  }

  await fs.mkdir(root, { recursive: true });

  const hash = digest(bytes);
  const file = path.join(root, hash);

  if ((await stat(file))?.isSymbolicLink()) {
    throw new Error("Invalid document archive entry");
  }

  try {
    await fs.writeFile(file, bytes, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }

  if (!(await fs.readFile(file)).equals(bytes)) {
    throw new Error("Conflicting document archive");
  }

  return hash;
}

async function archived(hash: string): Promise<Buffer<ArrayBuffer>> {
  if (
    !/^[a-f0-9]{64}$/.test(hash) ||
    (await stat(archiveRoot()))?.isSymbolicLink()
  ) {
    throw new Error("Invalid document hash");
  }

  const file = path.join(archiveRoot(), hash);

  if ((await stat(file))?.isSymbolicLink()) {
    throw new Error("Invalid document archive entry");
  }

  const bytes = await fs.readFile(file);

  if (digest(bytes) !== hash) {
    throw new Error("Document archive hash mismatch");
  }

  return toSafeBuffer(bytes);
}

async function atomicWrite(file: string, bytes: Uint8Array): Promise<void> {
  const temporary = path.join(archiveRoot(), `${randomUUID()}.tmp`);

  await fs.mkdir(path.dirname(file), { recursive: true });

  try {
    await fs.writeFile(temporary, bytes, { flag: "wx" });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

async function employeeFor(
  companyId: string,
  employeeId: string
): Promise<Employee> {
  const employee = await getEmployeeById(companyId, employeeId);

  if (!employee) {
    throw new Error("Employee not found");
  }

  return employee;
}

async function destination(
  employee: Employee,
  type: string,
  original: string,
  id?: string
): Promise<string> {
  const folder = employeeDocumentFolder(employee);

  if (Buffer.byteLength(folder) > 240) {
    throw new Error("Employee document folder is too long");
  }

  for (const other of await listDocumentEmployees(employee.companyId)) {
    if (
      other._id !== employee._id &&
      employeeDocumentFolder(other).toLowerCase() === folder.toLowerCase()
    ) {
      throw new Error("Employee document folder belongs to another employee");
    }
  }

  const relative = `${folder}/${documentName(type, original)}`;

  for (const other of await listLayoutDocuments(employee.companyId)) {
    if (
      other._id !== id &&
      !other.isDeleted &&
      other.localPath.toLowerCase() === relative.toLowerCase()
    ) {
      throw new Error("Conflicting employee document filename");
    }
  }

  return relative;
}

async function queueCleanup(source: string, bytes: Buffer): Promise<void> {
  const hash = await archive(bytes);
  const entries = await getDocumentCleanup();

  if (
    !entries.some((entry) => entry.source === source && entry.hash === hash)
  ) {
    await setDocumentCleanup([...entries, { source, hash }]);
  }
}

export async function cleanupEmployeeDocuments(): Promise<void> {
  const companyId = requireCompanyStorage().companyId;
  const documents = await listLayoutDocuments(companyId);

  for (const entry of await getDocumentCleanup()) {
    const source = await documentPath(entry.source);

    if (
      !(await stat(source)) ||
      documents.some(
        (document) => !document.isDeleted && document.localPath === entry.source
      )
    ) {
      continue;
    }

    const bytes = await fs.readFile(source);

    if (digest(bytes) !== entry.hash) continue;

    await archived(entry.hash);
    await fs.unlink(source);
  }

  await setDocumentCleanup([]);

  const removeEmpty = async (directory: string): Promise<void> => {
    for (const entry of await fs.readdir(directory, {
      withFileTypes: true,
    })) {
      if (entry.isDirectory()) {
        await removeEmpty(path.join(directory, entry.name));
      }
    }

    if (directory !== getEmployeeDocumentsDir()) {
      try {
        await fs.rmdir(directory);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOTEMPTY") {
          throw error;
        }
      }
    }
  };

  await removeEmpty(getEmployeeDocumentsDir());
}

export async function renameEmployeeDocuments(
  employee: Employee
): Promise<void> {
  for (const document of await listLayoutDocuments(employee.companyId)) {
    if (
      document.employeeId !== employee._id ||
      document.isDeleted ||
      !document.localPath
    ) {
      continue;
    }

    const relative = await destination(
      employee,
      document.documentType,
      document.localPath,
      document._id
    );

    const source = await documentPath(document.localPath);

    if (!(await stat(source))) continue;

    let bytes: Buffer<ArrayBuffer> = toSafeBuffer(await fs.readFile(source));

    if (document.hash && digest(bytes) !== document.hash) {
      bytes = await archived(document.hash);
      await atomicWrite(source, bytes);
    }

    await archive(bytes);

    if (relative !== document.localPath) {
      const target = await documentPath(relative);

      await fs.mkdir(path.dirname(target), { recursive: true });

      if (!(await stat(target))) {
        await fs.copyFile(source, target, constants.COPYFILE_EXCL);
      }

      if (!(await fs.readFile(target)).equals(bytes)) {
        throw new Error(`Conflicting employee document: ${relative}`);
      }

      await queueCleanup(document.localPath, bytes);
    }

    await renameDocumentReferences(document, relative, path.basename(relative));
  }
}

export async function migrateEmployeeDocuments(): Promise<void> {
  const companyId = requireCompanyStorage().companyId;

  await withEmployeeMedia(companyId, async () => {
    await cleanupEmployeeDocuments();

    await documentTransaction(async () => {
      for (const employee of await listDocumentEmployees(companyId)) {
        await renameEmployeeDocuments(employee);
      }
    });

    await cleanupEmployeeDocuments();

    const active = new Set(
      (await listLayoutDocuments(companyId))
        .filter((document) => !document.isDeleted)
        .map((document) => document.localPath)
    );

    const sweep = async (relative: string): Promise<void> => {
      const directory = relative
        ? await documentPath(relative)
        : getEmployeeDocumentsDir();

      for (const entry of await fs.readdir(directory, {
        withFileTypes: true,
      })) {
        const child = relative ? `${relative}/${entry.name}` : entry.name;

        if (entry.isSymbolicLink()) {
          throw new Error("Document symlinks are not supported");
        }

        if (entry.isDirectory()) {
          await sweep(child);
        } else if (!active.has(child)) {
          const file = await documentPath(child);
          await archive(await fs.readFile(file));
          await fs.unlink(file);
        }
      }
    };

    await sweep("");
    await cleanupEmployeeDocuments();
  });
}

async function writeDocument(
  companyId: string,
  build: () => Promise<{
    document: EmployeeDocument;
    existing?: EmployeeDocument;
    bytes: Buffer;
    persist: () => Promise<void>;
  }>
): Promise<EmployeeDocument> {
  return withEmployeeMedia(companyId, async () => {
    let undo: (() => Promise<void>) | undefined;
    let result: EmployeeDocument | undefined;

    try {
      await documentTransaction(async () => {
        const { document, existing, bytes, persist } = await build();
        const target = await documentPath(document.localPath);

        const oldBytes = (await stat(target))
          ? await fs.readFile(target)
          : null;

        if (
          oldBytes &&
          existing?.localPath !== document.localPath &&
          !oldBytes.equals(bytes)
        ) {
          throw new Error("Conflicting employee document file");
        }

        if (oldBytes) await archive(oldBytes);

        await archive(bytes);
        await atomicWrite(target, bytes);

        undo = async () => {
          if (oldBytes) {
            await atomicWrite(target, oldBytes);
          } else {
            await fs.rm(target, { force: true });
          }
        };

        if (existing?.localPath && existing.localPath !== document.localPath) {
          const source = await documentPath(existing.localPath);

          if (await stat(source)) {
            await queueCleanup(existing.localPath, await fs.readFile(source));
          }
        }

        await persist();
        result = document;
      });
    } catch (error) {
      if (undo) await undo();
      throw error;
    }

    await cleanupEmployeeDocuments();

    return result!;
  });
}

export async function uploadEmployeeDocument(
  file: UploadedEmployeeDocument
): Promise<EmployeeDocument> {
  return writeDocument(file.companyId, async () => {
    const employee = await employeeFor(file.companyId, file.employeeId);

    const existing = await getEmployeeDocument(
      file.companyId,
      file.employeeId,
      file.documentType
    );

    const localPath = await destination(
      employee,
      file.documentType,
      file.name,
      existing?._id
    );

    const now = new Date().toISOString();
    const bytes = toSafeBuffer(file.buffer);

    if (!bytes.length) {
      throw new Error("Document is empty");
    }

    const document: EmployeeDocument = {
      companyId: file.companyId,
      _id: existing?._id ?? randomUUID(),
      employeeId: file.employeeId,
      uploadedBy: file.uploadedBy,
      documentType: file.documentType,
      originalName: file.name,
      fileName: path.basename(localPath),
      localPath,
      mimeType: file.mimeType || "application/octet-stream",
      fileSize: bytes.length,
      hash: digest(bytes),
      serverVersion: existing?.serverVersion ?? file.serverVersion ?? 0,
      needsUpload: 1,
      isDeleted: 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    return {
      document,
      existing: existing ?? undefined,
      bytes,
      persist: async () => {
        if (existing) {
          await updateEmployeeDocument(file.companyId, document);
        } else {
          await upsertEmployeeDocument(document);
        }
      },
    };
  });
}

export async function installDownloadedDocument(
  incoming: EmployeeDocument,
  bytes: Buffer
): Promise<string> {
  const document = await writeDocument(incoming.companyId, async () => {
    const employee = await employeeFor(incoming.companyId, incoming.employeeId);

    const existing = await getEmployeeDocumentById(
      incoming.companyId,
      incoming._id
    );

    if (
      existing?.needsUpload ||
      (existing && existing.serverVersion > incoming.serverVersion)
    ) {
      throw new Error("Document changed during download; retry required");
    }

    if (!bytes.length || (incoming.hash && digest(bytes) !== incoming.hash)) {
      throw new Error("Downloaded document hash mismatch");
    }

    const localPath = await destination(
      employee,
      incoming.documentType,
      incoming.fileName || incoming.originalName,
      incoming._id
    );

    const safeBytes = toSafeBuffer(bytes);

    const document: EmployeeDocument = {
      ...incoming,
      localPath,
      fileName: path.basename(localPath),
      hash: digest(safeBytes),
      needsUpload: 0,
    };

    return {
      document,
      existing: existing ?? undefined,
      bytes: safeBytes,
      persist: () => upsertEmployeeDocument(document),
    };
  });

  return documentPath(document.localPath);
}

export async function employeeDocumentUploadBytes(
  companyId: string,
  relative: string,
  hash?: string
): Promise<Buffer> {
  return withEmployeeMedia(companyId, async () => {
    const file = await documentPath(relative);

    if (await stat(file)) {
      const bytes = await fs.readFile(file);

      if (!hash || digest(bytes) === hash) return bytes;
    }

    if (hash) return archived(hash);

    throw new Error("Employee document file missing");
  });
}

export async function updateStoredEmployeeDocument(
  companyId: string,
  incoming: EmployeeDocument
): Promise<void> {
  await withEmployeeMedia(companyId, async () => {
    await documentTransaction(async () => {
      const existing = await getEmployeeDocumentById(companyId, incoming._id);

      if (!existing || existing.employeeId !== incoming.employeeId) {
        throw new Error("Employee document not found");
      }

      // Renderer may edit metadata; file ownership and bytes come from SQLite.
      await updateEmployeeDocument(companyId, {
        ...incoming,
        companyId,
        localPath: existing.localPath,
        fileName: existing.fileName,
        hash: existing.hash,
        fileSize: existing.fileSize,
      });

      await renameEmployeeDocuments(
        await employeeFor(companyId, existing.employeeId)
      );
    });

    await cleanupEmployeeDocuments();
  });
}

// Cleanup is journaled in the import transaction and performed after pull commits.
export async function importEmployeeDocumentDeletion(
  incoming: EmployeeDocument
): Promise<void> {
  if (!incoming.isDeleted) throw new Error("Expected a deleted employee document");
  if (requireCompanyStorage().companyId !== incoming.companyId) {
    throw new Error("Employee document company mismatch");
  }
  await withEmployeeMedia(incoming.companyId, async () => {
    await documentTransaction(async () => {
      const existing = await getEmployeeDocumentById(incoming.companyId, incoming._id);
      if (!existing) return;
      if (existing.needsUpload) throw new Error("Employee document has pending local changes");
      if (existing.serverVersion > incoming.serverVersion) return;
      if (existing.localPath) {
        const file = await documentPath(existing.localPath);
        if (await stat(file)) await queueCleanup(existing.localPath, await fs.readFile(file));
      }
      await applyEmployeeDocumentDeletion(incoming);
    });
  });
}

export async function deleteStoredEmployeeDocument(
  companyId: string,
  id: string
): Promise<boolean> {
  return withEmployeeMedia(companyId, async () => {
    const existing = await getEmployeeDocumentById(companyId, id);

    if (!existing) return false;

    await documentTransaction(async () => {
      const file = await documentPath(existing.localPath);

      if (await stat(file)) {
        await queueCleanup(existing.localPath, await fs.readFile(file));
      }

      await deleteEmployeeDocument(companyId, id);
    });

    await cleanupEmployeeDocuments();

    return true;
  });
}
