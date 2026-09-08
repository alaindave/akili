import { randomUUID } from "crypto";
import Company from "./models/company.model.js";
import Employee from "./models/employee.model.js";
import Attendance from "./models/attendance.model.js";
import Leave from "./models/leave.model.js";
import AdminUser from "./models/adminUser.model.js";
import Task from "./models/task.model.js";
import { getNextSyncVersion } from "./utils/syncVersion.js";

interface EmployeeInput {
  companyId: string;
  firstName: string;
  lastName: string;
  employeeID: string;
  dateBirth: Date;
  role: string;
  department: string;
  salary: number;
  dateHired: Date;
  telephone: string;
  address: string;
  emergencyContact: string;
  relationship: string;
  contactPhone: string;
}

interface AdminUserInput {
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
}

interface TaskInput {
  companyId: string;
  author: string;
  recipients: string[];
  message: string;
  createdAt: Date;
}

interface AttendanceUpdate {
  companyId: string;
  clockIn?: Date;
  clockOut?: Date;
  status?: string;
  lateMinutes?: number;
  [key: string]: unknown;
}

// ================= COMPANY =================

export const getCompanyById = async (companyId: string) => {
  return Company.findOne({
    companyId,
  });
};

// ================= ADMIN =================

export const createAdminUser = async ({
  companyId,
  firstName,
  lastName,
  email,
  passwordHash,
}: AdminUserInput) => {
  const serverVersion = await getNextSyncVersion("admin_user");

  const adminUser = new AdminUser({
    companyId,
    _id: randomUUID(),
    firstName,
    lastName,
    email,
    passwordHash,
    serverVersion,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return await adminUser.save();
};

export const getAllAdmins = async () => {
  return AdminUser.find();
};

export const getAdminUserByID = async (id: string) => {
  return AdminUser.findOne({
    _id: id,
  });
};

export const getAdminUserByEmail = async (email: string) => {
  return AdminUser.findOne({
    email,
  });
};

export const updateAdminUser = async (
  id: string,
  data: Record<string, unknown>
) => {
  return AdminUser.findByIdAndUpdate(id, data, {
    new: true,
  });
};

// ================= EMPLOYEE =================

export const addEmployee = async ({
  firstName,
  lastName,
  employeeID,
  dateBirth,
  role,
  department,
  salary,
  dateHired,
  telephone,
  address,
  emergencyContact,
  relationship,
  contactPhone,
}: EmployeeInput) => {
  const employee = new Employee({
    firstName,
    lastName,
    employeeID,
    dateBirth,
    role,
    department,
    salary,
    dateHired,
    telephone,
    address,
    emergencyContact,
    relationship,
    contactPhone,
  });

  return await employee.save();
};

export const getEmployees = async () => {
  return await Employee.find().sort({
    lastName: 1,
  });
};

export const getEmployee = async (id: string) => {
  return await Employee.findById(id);
};

export const updateEmployee = async (
  id: string,
  data: Partial<EmployeeInput>
) => {
  return await Employee.findByIdAndUpdate(id, data, { new: true });
};

export const deleteEmployee = async (id: string) => {
  await Employee.deleteOne({
    _id: id,
  });

  await Attendance.deleteMany({
    employee: id,
  });

  await Leave.deleteMany({
    employee: id,
  });

  console.log("Transaction was successful.");
};

// ================= ATTENDANCE =================

export const addAttendance = async (employeeId: string, clockIn: Date) => {
  const expectedClockIn = new Date();

  const date = expectedClockIn.toISOString().split("T")[0];

  expectedClockIn.setHours(6, 0, 0, 0);

  const diffMs = new Date(clockIn).getTime() - expectedClockIn.getTime();

  const lateMinutes = Math.max(0, Math.floor(diffMs / 60000));

  const status = lateMinutes > 0 ? "RETARD" : "PONCTUEL";

  const attendance = new Attendance({
    employee: employeeId,
    date,
    clockIn,
    status,
    lateMinutes,
  });

  return await attendance.save();
};

export const getAttendanceByDate = async (date: string) => {
  return await Attendance.find({
    date,
  })
    .sort({
      clockIn: 1,
    })
    .populate("employee", "firstName lastName employeeID role department");
};

export const getAttendanceByEmployeeID = async (employeeId: string) => {
  return await Attendance.findOne({
    date: new Date().toISOString().split("T")[0],
    employee: employeeId,
  });
};

export const getAttendance = async (id: string) => {
  return await Attendance.findById(id);
};

export const editAttendance = async (id: string, data: AttendanceUpdate) => {
  return await Attendance.findByIdAndUpdate(id, data, {
    new: true,
  });
};

export const deleteAttendance = async (id: string) => {
  return await Attendance.findByIdAndDelete(id);
};

// ================= LEAVE =================

export const addLeave = async (
  employeeId: string,
  startDate: Date,
  endDate: Date,
  subject: string,
  notes: string
) => {
  const leave = new Leave({
    employee: employeeId,
    submittedAt: new Date(),
    startDate,
    endDate,
    subject,
    notes,
  });

  const savedLeave = await leave.save();

  return Leave.findById(savedLeave._id).populate(
    "employee",
    "firstName lastName employeeID department role remainingLeave"
  );
};

export const getLeavesByMonth = async (month: number, year: number) => {
  const start = new Date(year, month - 1, 1);

  const end = new Date(year, month, 1);

  return await Leave.find({
    submittedAt: {
      $gte: start,
      $lt: end,
    },
  }).sort({
    submittedAt: 1,
  });
};

export const getOnGoingLeaves = async () => {
  const today = new Date();

  return await Leave.find({
    status: "APPROUVÉ",
    startDate: {
      $lte: today,
    },
    endDate: {
      $gte: today,
    },
  });
};

export const getLeaveByID = async (id: string) => {
  return await Leave.findById(id);
};

export const getPendingLeaves = async (employeeId: string) => {
  return await Leave.find({
    employee: employeeId,
    status: "EN ATTENTE D'APPROBATION",
  });
};

export const editLeave = async (id: string, data: Record<string, unknown>) => {
  return Leave.findByIdAndUpdate(id, data, {
    new: true,
  });
};

export const deleteLeave = async (id: string) => {
  return Leave.findByIdAndDelete(id);
};

// ================= TASK =================

export const saveTask = async (task: TaskInput) => {
  const newTask = new Task({
    _id: randomUUID(),
    author: task.author,
    recipients: task.recipients,
    message: task.message,
    createdAt: task.createdAt,
    updatedAt: task.createdAt,
    isDeleted: 0,
  });

  return await newTask.save();
};

export const getTasks = async () => {
  return Task.find().sort({
    createdAt: -1,
  });
};
