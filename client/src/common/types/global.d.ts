export {};
import type Employee from "./Employee";
import type Attendance from "./Attendance";
import type Leave from "./Leave";
import type AttendanceWithEmployee from "./AttendanceWithEmployee";
import type LeaveWithEmployee from "./LeaveWithEmployee";
import type Task from "./Task";
import type AdminUser from "./AdminUser";
import type TaskRecipient from "./AdminUser";
import { TaskComment } from "./Task";
import type {
  PayrollRun,
  PayrollResultRecord,
  PayrollStatus,
} from "../../common/types/payroll/Payroll";
import PayrollItem from "./payroll/PayrollItem";
import type {
  EmailDeliveryResult,
  EmailNotification,
} from "./EmailNotification";

interface SaveFileResult {
  success: boolean;
  filePath?: string;
}

interface AdminCredentials {
  email: string;
  password: string;
}

interface SignUpCredentials {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  signUpCode: string;
}

interface LoggedUser {
  company: Company;
  admin: OfflineUser;
}

interface Reminder {
  id: string;
  message: string;
  remindAt: string;
}

declare global {
  interface Window {
    electron: {
      email: {
        send: (notification: EmailNotification) => Promise<EmailDeliveryResult>;
      };
      app: {
        getUserDataPath: () => Promise<String>;
      };
      file: { save: (data: string) => Promise<SaveFileResult> };

      auth: {
        login: (credentials: AdminCredentials) => Promise<LoggedUser>;
        sign_up: (credentials: SignUpCredentials) => Promise<LoggedUser>;
        logout: () => boolean;
      };

      offlineUsers: {
        save: (companyId: string, user: OfflineUser) => Promise<OfflineUser>;
        saveNotes: (
          companyId: string,
          _id: string,
          notes: string
        ) => Promise<OfflineUser>;
        login: (credentials: LoginCredentials) => Promise<OfflineUser>;
        getById: (companyId: string, _id: string) => Promise<OfflineUser>;
        getByEmail: (companyId: string, email: string) => Promise<OfflineUser>;
        getAll: (companyId: string) => Promise<OfflineUser[]>;
        delete: (companyId: string, _id: string) => Promise<OfflineUser>;
      };

      adminUsers: {
        getAll: (companyId: string) => Promise<AdminUser[]>;
      };

      employees: {
        create: (
          companyId: string,
          employee: Partial<Employee>
        ) => Promise<Employee>;
        uploadPhoto: (
          companyId: string,
          employeeId: string,
          file: { name: string; buffer: ArrayBuffer }
        ) => Promise<Employee>;
        getPhotoUrl: (relativePath: string) => Promise<string>;
        getAll: (companyId: string) => Promise<Employee[]>;
        getById: (companyId: string, _id: string) => Promise<Employee>;
        search: (companyId: string, searchTerm: string) => Promise<Employee[]>;
        update: (
          companyId: string,
          _id: string,
          data: Partial<Employee>
        ) => Promise<Employee | null>;
        delete: (companyId: string, _id: string) => Promise<void>;
      };

      employees_documents: {
        view: (
          companyId: string,
          localPath: string
        ) => Promise<EmployeeDocument>;
        download: (
          companyId: string,
          document: EmployeeDocument
        ) => Promise<EmployeeDocument>;
        upload: (
          document: UploadedEmployeeDocument
        ) => Promise<EmployeeDocument>;
        create: (document: EmployeeDocument) => Promise<EmployeeDocument>;
        getAll: (companyId: string) => Promise<EmployeeDocument[]>;
        getById: (companyId: string, _id: string) => Promise<EmployeeDocument>;
        getByEmployee: (
          companyId: string,
          employeeId: string
        ) => Promise<EmployeeDocument[]>;
        getByType: (
          companyId: string,
          employeeId: string,
          documentType: string
        ) => Promise<EmployeeDocument>;
        update: (document: EmployeeDocument) => Promise<EmployeeDocument>;
        delete: (companyId: string, _id: string) => Promise<EmployeeDocument>;
        getUnsynced: (companyId: string) => Promise<EmployeeDocument>;
        markSynced: (
          companyId: string,
          _id: string
        ) => Promise<EmployeeDocument>;
        upsert: (document: EmployeeDocument) => Promise<EmployeeDocument>;
      };

      attendanceDailyCheck: {
        create(
          companyId: string,
          data: CreateAttendanceDailyCheckInput
        ): Promise<AttendanceDailyCheck>;
        getById(
          companyId: string,
          _id: string
        ): Promise<AttendanceDailyCheck | null>;
        getByDate(
          companyId: string,
          date: string
        ): Promise<AttendanceDailyCheck | null>;
        getAll(companyId: string): Promise<AttendanceDailyCheck[]>;
        verify(
          input: VerifyAttendanceDailyCheckInput
        ): Promise<VerifyDailyAttendanceResult>;
        notifyManager: (
          input: MarkManagerNotifiedInput
        ) => Promise<AttendanceDailyCheck>;
        lock(
          input: LockAttendanceDailyCheckInput
        ): Promise<AttendanceDailyCheck>;
      };

      attendance: {
        create: (
          companyId: string,
          input: CreateAttendanceDto
        ) => Promise<Attendance>;
        createAbsenceLeave: (
          companyId: string,
          employeeID: string,
          status: "CONGÉ" | "ABSENT",
          date: string
        ) => Promise<Attendance>;
        getAll: (companyId: string) => Promise<AttendanceWithEmployee[]>;
        getById: (
          companyId: string,
          _id: string
        ) => Promise<AttendanceWithEmployee | null>;
        getByEmployee: (
          companyId: string,
          employeeId: string
        ) => Promise<Attendance[]>;
        getByDate: (
          companyId: string,
          date: string
        ) => Promise<AttendanceWithEmployee[]>;
        getEmployeesWithoutAttendance: (
          companyId: string,
          date: string
        ) => romise<AttendanceWithEmployee[]>;
        getAttendanceRecord: (
          companyId: string,
          employeeId: string,
          date: string
        ) => Promise<AttendanceWithEmployee>;
        update: (
          companyId: string,
          _id: string,
          date: String,
          updates: Partial<AttendanceWithEmployee>
        ) => Promise<AttendanceWithEmployee>;

        markAbsent: (
          companyId: string,
          date: string
        ) => Promise<{
          absentAttendance: any;
          source: "AUTO_SERVER" | "LOCAL" | "SKIPPED";
          completed: boolean;
          timestamp: string;
        }>;

        delete: (
          companyId: string,
          _id: string
        ) => Promise<AttendanceWithEmployee>;
      };

      attendanceReports: {
        savePdf: (
          companyId: string,
          date: string
        ) => Promise<{
          success: boolean;
          canceled?: boolean;
          filePath?: string;
        }>;

        printPdf: (
          companyId,
          date: string
        ) => Promise<{
          success: boolean;
          canceled?: boolean;
        }>;
      };

      leave: {
        create: (
          companyId: string,
          leave: Partial<Leave>
        ) => Promise<LeaveWithEmployee>;
        getLeaveByEmployeeId: (
          companyId: string,
          employeeId: string
        ) => Promise<Leave[]>;
        getLeaveById: (
          companyId: string,
          _id: string
        ) => Promise<LeaveWithEmployee>;
        getOngoingLeaves: (
          companyId: string,
          date: string
        ) => Promise<LeaveWithEmployee[]>;
        getLeaveByMonth: (
          companyId: string,
          month: string
        ) => Promise<LeaveWithEmployee[]>;
        cancel: (companyId: string, _id: string) => Promise<LeaveWithEmployee>;
        update: (
          companyId: string,
          _id: string,
          updates: {
            subject?: string;
            notes?: string;
            startDate?: string;
            endDate?: string;
            status?: string;
          }
        ) => Promise<LeaveWithEmployee>;
        delete: (companyId: string, _id: string) => Promise<LeaveWithEmployee>;
      };

      payrollSettings: {
        get: (companyId: string) => Promise<PayrollSettings | null>;
        getById: (
          companyId: string,
          _id: string
        ) => Promise<PayrollSettings | null>;
        create: (
          companyId: string,
          data: {
            currency: string;
            workingDays: number;
            workingHours: number;
            paymentDay: number;
          }
        ) => Promise<PayrollSettings>;
        update: (
          companyId: string,
          settings: PayrollSettings
        ) => Promise<PayrollSettings>;
        updateFields: (
          companyId: string,
          _id: string,
          fields: Partial<
            Pick<
              PayrollSettings,
              "currency" | "workingDays" | "workingHours" | "paymentDay"
            >
          >
        ) => Promise<PayrollSettings>;
        delete: (
          companyId: string,
          _id: string
        ) => Promise<{
          success: boolean;
        }>;
        restore: (companyId: string, _id: string) => Promise<PayrollSettings>;
        markSynced: (
          companyId: string,
          _id: string
        ) => Promise<{
          success: boolean;
        }>;
        getUnsynced: (companyId: string) => Promise<PayrollSettings[]>;
      };

      payrollComponents: {
        create: (
          companyId: string,
          component: CreatePayrollComponentDto
        ) => Promise<PayrollComponent>;
        getAll: (
          companyId: string,
          type?: "EARNING" | "DEDUCTION"
        ) => Promise<PayrollComponent[]>;
        getEnabled: (
          companyId: string,
          type?: "EARNING" | "DEDUCTION"
        ) => Promise<PayrollComponent[]>;
        getById: (
          companyId: string,
          id: string
        ) => Promise<PayrollComponent | null>;
        update: (
          companyId: string,
          component: PayrollComponent[]
        ) => Promise<PayrollComponent[] | null>;
        delete: (companyId: string, _id: string) => Promise<void>;
        setEnabled: (
          companyId: string,
          _id: string,
          enabled: boolean
        ) => Promise<PayrollComponent | null>;
        upsert: (
          companyId: string,
          component: PayrollComponent
        ) => Promise<PayrollComponent | null>;
        getUnsynced: (companyId: string) => Promise<PayrollComponent[]>;
        markSynced: (
          companyId: string,
          _id: string
        ) => Promise<PayrollComponent | null>;
      };

      payrollEmployeeProfiles: {
        create(
          companyId: string,
          employeeID: string,
          profile: CreatePayrollProfileDto
        ): Promise<void>;
        createMany(
          companyId: string,
          employeeID: string,
          profiles: CreatePayrollProfileDto[]
        ): Promise<void>;
        update(
          companyId: string,
          profile: PayrollEmployeeProfile
        ): Promise<void>;
        updateMany(
          companyId: string,
          profiles: PayrollEmployeeProfile[]
        ): Promise<void>;
        upsert(
          companyId: string,
          profile: PayrollEmployeeProfile
        ): Promise<void>;
        upsertMany(
          companyId: string,
          profiles: PayrollEmployeeProfile[]
        ): Promise<void>;
        get(
          companyId: string,
          _id: string
        ): Promise<PayrollEmployeeProfile | undefined>;
        getAll: (
          companyId: string,
          employeeID?: string,
          type?: "EARNING" | "DEDUCTION"
        ) => Promise<PayrollEmployeeProfile[]>;
        getByEmployee(
          companyId: string,
          employeeId: string
        ): Promise<PayrollEmployeeProfile[]>;
        getByComponent(
          companyId: string,
          employeeId: string,
          componentId: string
        ): Promise<PayrollEmployeeProfile | undefined>;
        getUnsynced(companyId: string): Promise<PayrollEmployeeProfile[]>;
        markSynced(companyId: string, _id: string): Promise<void>;
        markManySynced(companyId: string, ids: string[]): Promise<void>;
        delete(companyId: string, _id: string): Promise<void>;
        restore(companyId: string, _id: string): Promise<void>;
        permanentlyDelete(companyId: string, _id: string): Promise<void>;
        exists(
          companyId: string,
          employeeId: string,
          componentId: string
        ): Promise<boolean>;
        count(companyId: string): Promise<number>;
        initialize(companyId: string): Promise<void>;
        initializeForEmployee(
          companyId: string,
          employeeId: string
        ): Promise<void>;
        addComponentToEmployees(
          companyId: string,
          component: PayrollComponent
        ): Promise<void>;
        resetToDefaults(companyId: string, employeeId: string): Promise<void>;
      };

      payrollRun: {
        createPayrollDraft(
          companyId: string,
          admin: AdminUser,
          year: number,
          month: number
        ): Promise<PayrollRun>;

        getPayrollRuns(
          companyId: string,
          year: number,
          month: number
        ): Promise<PayrollRun[]>;

        getPayrollRunById(
          companyId: string,
          _id: string
        ): Promise<PayrollRun | null>;

        // BROUILLON → EN_VERIFICATION
        submitForVerification(
          companyId: string,
          payrollRunId: string,
          admin: AdminUser
        ): Promise<void>;

        // EN_VERIFICATION → BROUILLON
        returnToDraft(companyId: string, payrollRunId: string): Promise<void>;

        // EN_VERIFICATION → APPROUVÉ
        approvePayroll(
          companyId: string,
          payrollRunId: string,
          admin: AdminUser
        ): Promise<void>;

        // APPROUVÉ → PAYÉ
        markPayrollAsPaid(
          companyId: string,
          payrollRunId: string,
          admin: AdminUser
        ): Promise<void>;

        // BROUILLON / EN_VERIFICATION / APPROUVÉ → ANNULÉ
        cancelPayroll(
          companyId: string,
          payrollRunId: string,
          admin: AdminUser
        ): Promise<void>;

        getPayrollResults(
          companyId: string,
          payrollRunId: string
        ): Promise<PayrollResultRecord[]>;

        getEmployeePayrollResults(
          companyId: string,
          employeeId: string,
          payrollRunId?: string
        ): Promise<PayrollResultRecord | null>;

        getPayrollItems(
          companyId: string,
          payrollResultId: string,
          employeeId?: string
        ): Promise<PayrollItem[]>;

        deletePayrollRun(
          companyId: string,
          payrollResultId: string
        ): Promise<void>;
      };

      tasks: {
        create: (
          companyId: string,
          data: Omit<Task, "_id" | "createdAt">
        ) => Promise<Task>;
        update: (companyId: string, task: Task) => Promise<Task>;
        delete: (companyId: string, taskId: string) => Promise<Task>;
        getAll: (companyId: string) => Promise<Task[]>;
        getById: (companyId: string, _id: string) => Promise<Task>;
        getUserTasks: (companyId: string, userId: string) => Promise<Task[]>;
        getTopTasks: (companyId: string, userId: string) => Promise<Task[]>;
        onNew: (
          callback: (companyId: string, data: Task) => void
        ) => () => void;
      };

      taskComments: {
        create: (
          companyId: string,
          payload: {
            taskId: string;
            author: string;
            comment: string;
          }
        ) => Promise<TaskComment>;

        getByTaskId: (
          companyId: string,
          taskId: string
        ) => Promise<TaskComment>;
        delete: (companyId: string, commentId: string) => Promise<void>;
      };

      sync: (companyId: string) => Promise<{
        success: boolean;
        message: string;
      }>;

      onSyncStatus: (callback: (event: SyncStatusEvent) => void) => () => void;

      onPendingChanges: (
        callback: (data: { pendingChanges: number; timestamp: string }) => void
      ) => () => void;

      notifications: {
        scheduleReminder(
          message: string,
          remindAt: string
        ): Promise<{
          success: boolean;
          reminder?: Reminder;
          message?: string;
        }>;

        cancelReminder(id: string): Promise<{
          success: boolean;
        }>;

        cancelAllReminders(): Promise<{
          success: boolean;
        }>;
      };
    };
  }
}
