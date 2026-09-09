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
        save: (user: OfflineUser) => Promise<LoggedUser>;
        saveNotes: (_id: string, notes: string) => Promise<LoggedUser>;
        login: (credentials: LoginCredentials) => Promise<LoggedUser>;
        getById: (_id: string) => Promise<LoggedUser>;
        getByEmail: (email: string) => Promise<LoggedUser>;
        getAll: () => Promise<LoggedUser[]>;
        delete: (_id: string) => Promise<LoggedUser>;
      };

      tasks: {
        create: (data: Omit<Task, "_id" | "createdAt">) => Promise<Task>;
        update: (task: Task) => Promise<Task>;
        delete: (taskId: string) => Promise<Task>;
        getAll: () => Promise<Task[]>;
        getById: (_id: string) => Promise<Task>;
        getUserTasks: (userId: string) => Promise<Task[]>;
        getTopTasks: (userId: string) => Promise<Task[]>;
        onNew: (callback: (data: Task) => void) => () => void;
      };

      taskComments: {
        create: (payload: {
          taskId: string;
          author: string;
          comment: string;
        }) => Promise<TaskComment>;

        getByTaskId: (taskId: string) => Promise<TaskComment>;
        delete: (commentId: string) => Promise<void>;
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
        savePdf: (date: string) => Promise<{
          success: boolean;
          canceled?: boolean;
          filePath?: string;
        }>;

        printPdf: (date: string) => Promise<{
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
        get: () => Promise<PayrollSettings | null>;
        getById: (_id: string) => Promise<PayrollSettings | null>;
        create: (data: {
          currency: string;
          workingDays: number;
          workingHours: number;
          paymentDay: number;
        }) => Promise<PayrollSettings>;
        update: (settings: PayrollSettings) => Promise<PayrollSettings>;
        updateFields: (
          _id: string,
          fields: Partial<
            Pick<
              PayrollSettings,
              "currency" | "workingDays" | "workingHours" | "paymentDay"
            >
          >
        ) => Promise<PayrollSettings>;
        delete: (_id: string) => Promise<{
          success: boolean;
        }>;
        restore: (_id: string) => Promise<PayrollSettings>;
        markSynced: (_id: string) => Promise<{
          success: boolean;
        }>;
        getUnsynced: () => Promise<PayrollSettings[]>;
      };

      payrollComponents: {
        create: (component: PayrollComponent) => Promise<PayrollComponent>;
        getAll: (type?: "EARNING" | "DEDUCTION") => Promise<PayrollComponent[]>;
        getEnabled: (
          type?: "EARNING" | "DEDUCTION"
        ) => Promise<PayrollComponent[]>;
        getById: (id: string) => Promise<PayrollComponent | null>;
        update: (
          component: PayrollComponent[]
        ) => Promise<PayrollComponent[] | null>;
        delete: (id: string) => Promise<void>;
        setEnabled: (
          id: string,
          enabled: boolean
        ) => Promise<PayrollComponent | null>;
        upsert: (
          component: PayrollComponent
        ) => Promise<PayrollComponent | null>;
        getUnsynced: () => Promise<PayrollComponent[]>;
        markSynced: (id: string) => Promise<PayrollComponent | null>;
      };

      payrollEmployeeProfiles: {
        create(
          employeeID: string,
          profile: CreatePayrollProfileDto
        ): Promise<void>;
        createMany(
          employeeID: string,
          profiles: CreatePayrollProfileDto[]
        ): Promise<void>;
        update(profile: PayrollEmployeeProfile): Promise<void>;
        updateMany(profiles: PayrollEmployeeProfile[]): Promise<void>;
        upsert(profile: PayrollEmployeeProfile): Promise<void>;
        upsertMany(profiles: PayrollEmployeeProfile[]): Promise<void>;
        get(_id: string): Promise<PayrollEmployeeProfile | undefined>;
        getAll: (
          employeeID?: string,
          type?: "EARNING" | "DEDUCTION"
        ) => Promise<PayrollEmployeeProfile[]>;
        getByEmployee(employeeId: string): Promise<PayrollEmployeeProfile[]>;
        getByComponent(
          employeeId: string,
          componentId: string
        ): Promise<PayrollEmployeeProfile | undefined>;
        getUnsynced(): Promise<PayrollEmployeeProfile[]>;
        markSynced(_id: string): Promise<void>;
        markManySynced(ids: string[]): Promise<void>;
        delete(_id: string): Promise<void>;
        restore(_id: string): Promise<void>;
        permanentlyDelete(_id: string): Promise<void>;
        exists(employeeId: string, componentId: string): Promise<boolean>;
        count(): Promise<number>;
        initialize(): Promise<void>;
        initializeForEmployee(employeeId: string): Promise<void>;
        addComponentToEmployees(component: PayrollComponent): Promise<void>;
        resetToDefaults(employeeId: string): Promise<void>;
      };

      payrollRun: {
        createPayrollDraft(
          admin: AdminUser,
          year: number,
          month: number
        ): Promise<PayrollRun>;

        getPayrollRuns(year: number, month: number): Promise<PayrollRun[]>;

        getPayrollRunById(_id: string): Promise<PayrollRun | null>;

        // BROUILLON → EN_VERIFICATION
        submitForVerification(
          payrollRunId: string,
          admin: AdminUser
        ): Promise<void>;

        // EN_VERIFICATION → BROUILLON
        returnToDraft(payrollRunId: string): Promise<void>;

        // EN_VERIFICATION → APPROUVÉ
        approvePayroll(payrollRunId: string, admin: AdminUser): Promise<void>;

        // APPROUVÉ → PAYÉ
        markPayrollAsPaid(
          payrollRunId: string,
          admin: AdminUser
        ): Promise<void>;

        // BROUILLON / EN_VERIFICATION / APPROUVÉ → ANNULÉ
        cancelPayroll(payrollRunId: string, admin: AdminUser): Promise<void>;

        getPayrollResults(payrollRunId: string): Promise<PayrollResultRecord[]>;

        getEmployeePayrollResults(
          employeeId: string,
          payrollRunId?: string
        ): Promise<PayrollResultRecord | null>;

        getPayrollItems(
          payrollResultId: string,
          employeeId?: string
        ): Promise<PayrollItem[]>;

        deletePayrollRun(payrollResultId: string): Promise<void>;
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
