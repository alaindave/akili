import { ipcMain } from "electron";
import path from "path";
import fs from "fs";

import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  searchEmployees,
} from "../../../database/repositories/modules/hr/employees.repository.js";

import { uploadEmployeePhoto } from "../../../database/repositories/modules/hr/employees_photos.repository.js";
import { getEmployeePhotoDir } from "../../../storage/directories.js";

export function registerEmployeeIPC() {
  console.log("REGISTERING EMPLOYEES IPC");

  // Create employee
  ipcMain.handle("employees:create", async (_, companyId, employee) => {
    console.log(
      `EMPLOYEE CREATE IPC RECEIVED for employee: ${employee}.Company: ${companyId}`,
      employee
    );

    return createEmployee(companyId, employee);
  });

  // Upload employee photo
  ipcMain.handle(
    "employees:uploadPhoto",
    async (_, companyId, employeeId, file) => {
      console.log("EMPLOYEE PHOTO UPLOAD RECEIVED");

      const uploadResults = await uploadEmployeePhoto(
        companyId,
        employeeId,
        file
      );

      console.log("UPLOAD RESULTS:", uploadResults);

      return uploadResults;
    }
  );

  // Get all employees
  ipcMain.handle("employees:getAll", async (_, companyId) => {
    return getAllEmployees(companyId);
  });

  // Get employee by ID
  ipcMain.handle("employees:getById", async (_, companyId, employeeId) => {
    return getEmployeeById(companyId, employeeId);
  });

  // Get employee photo
  ipcMain.handle("photos:getUrl", (_, relativePath: string) => {
    const fullPath = path.join(getEmployeePhotoDir(), relativePath);
    console.log("RELATIVE PATH:", relativePath);
    console.log("FULL PATH:", fullPath);
    console.log("EXISTS:", fs.existsSync(fullPath));

    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);

      console.log("IS FILE:", stat.isFile());
      console.log("IS DIRECTORY:", stat.isDirectory());
      console.log("SIZE:", stat.size);
    }

    const buffer = fs.readFileSync(fullPath);
    return buffer.toString("base64");
  });

  // Update employee
  ipcMain.handle(
    "employees:update",
    async (_, companyId, employeeId, employee) => {
      return updateEmployee(companyId, employeeId, employee);
    }
  );

  // Delete employee
  ipcMain.handle("employees:delete", async (_, companyId, employeeId) => {
    return deleteEmployee(companyId, employeeId);
  });

  // Search employees
  ipcMain.handle("employees:search", async (_, companyId, searchTerm) => {
    return searchEmployees(companyId, searchTerm);
  });
}
