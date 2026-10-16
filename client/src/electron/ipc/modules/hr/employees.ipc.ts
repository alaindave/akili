import { ipcMain } from "../../companyIpc.js";

import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  deleteEmployee,
  searchEmployees,
} from "../../../database/repositories/modules/hr/employees.repository.js";

import { uploadEmployeePhoto, updateEmployeeWithPhoto, readEmployeePhoto } from "../../../services/shared/employeePhoto.service.js";

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
  ipcMain.handle("photos:getUrl", (_, relativePath: string) => readEmployeePhoto(relativePath));

  // Update employee
  ipcMain.handle(
    "employees:update",
    async (_, companyId, employeeId, employee) => {
      return updateEmployeeWithPhoto(companyId, employeeId, employee);
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
