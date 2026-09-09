const { contextBridge, ipcRenderer } = require("electron");

type OfflineUser = import("../common/types/OfflineUser", {
  with: { "resolution-mode": "require" },
}).default;

type Employee = import("../common/types/Employee", {
  with: { "resolution-mode": "require" },
}).default;

type AdminUser = import("../common/types/AdminUser", {
  with: { "resolution-mode": "require" },
}).default;

type AttendanceWithEmployee = typeof import("../common/types/Attendance", {
  with: { "resolution-mode": "require" },
});

type Leave = import("../common/types/Leave", {
  with: { "resolution-mode": "require" },
}).default;

type Task = import("../common/types/Task", {
  with: { "resolution-mode": "require" },
}).default;

type EmployeeDocument = typeof import("../common/types/EmployeeDocuments", {
  with: { "resolution-mode": "require" },
});

type UploadedEmployeeDocument = typeof import("../common/types/EmployeeDocuments", {
  with: { "resolution-mode": "require" },
});

type CreatePayrollComponentDto = import(
  "../common/types/payroll/PayrollComponent",
  {
    with: { "resolution-mode": "require" },
  }
).default;

type CreatePayrollProfileDto = import(
  "../common/types/payroll/CreatePayrollProfileDto",
  {
    with: { "resolution-mode": "require" },
  }
).default;

type PayrollComponent = import(
  "../common/types/payroll/PayrollComponent",
  {
    with: { "resolution-mode": "require" },
  }
).default;

type EmployeePayrollProfile = import(
  "../common/types/payroll/PayrollEmployeeProfile",
  {
    with: { "resolution-mode": "require" },
  }
).default;

type AttendanceDailyCheckPreparationInput = typeof import(
  "../common/types/AttendanceDailyCheck",
  {
    with: { "resolution-mode": "require" },
  }
);

type LockAttendanceDailyCheckInput = typeof import(
  "../common/types/AttendanceDailyCheck",
  {
    with: { "resolution-mode": "require" },
  }
);

type MarkManagerNotifiedInput = typeof import(
  "../common/types/AttendanceDailyCheck",
  {
    with: { "resolution-mode": "require" },
  }
);

type VerifyAttendanceDailyCheckInput = typeof import(
  "../common/types/AttendanceDailyCheck",
  {
    with: { "resolution-mode": "require" },
  }
);

type CreateAttendanceDto = typeof import("../common/types/Attendance", {
  with: { "resolution-mode": "require" },
});

type SyncStatusEvent = typeof import("../common/types/Sync", {
  with: { "resolution-mode": "require" },
});

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignUpCredentials {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  signUpCode:string;
}

console.log("PRELOAD LOADED!!!");

contextBridge.exposeInMainWorld("electron", {
  // ============================================================
  // APP
  // ============================================================

  app: {
    getUserDataPath: () =>
      ipcRenderer.invoke("app:getUserDataPath"),
  },

  // ============================================================
  // AUTH
  // ============================================================

  auth: {
    login: (credentials: LoginCredentials) =>
      ipcRenderer.invoke("auth:login", credentials),

    sign_up: (credentials: SignUpCredentials) =>
      ipcRenderer.invoke("auth:signup", credentials),

    logout: () =>
      ipcRenderer.invoke("auth:logout"),
  },

   // ============================================================
  // ADMIN USERS
  // ============================================================

  adminUsers: {
    getAll: (
      companyId: string
    ) =>
      ipcRenderer.invoke(
        "adminUsers:getAll",
        companyId
      ),
  },

  // ============================================================
  // OFFLINE USERS
  // ============================================================

  offlineUsers: {
    save: (user: OfflineUser) =>
      ipcRenderer.invoke(
        "offline-users:save",
        user
      ),

    saveNotes: (
      _id: string,
      notes: string
    ) =>
      ipcRenderer.invoke(
        "offline-users:saveNotes",
        _id,
        notes
      ),

    login: (credentials: LoginCredentials) =>
      ipcRenderer.invoke(
        "offline-users:login",
        credentials
      ),

    getById: (_id: string) =>
      ipcRenderer.invoke(
        "offline-users:getById",
        _id
      ),

    getByEmail: (email: string) =>
      ipcRenderer.invoke(
        "offline-users:getByEmail",
        email
      ),

    getAll: () =>
      ipcRenderer.invoke(
        "offline-users:getAll"
      ),

    delete: (_id: string) =>
      ipcRenderer.invoke(
        "offline-users:delete",
        _id
      ),
  },

  // ============================================================
  // EMPLOYEES
  // ============================================================

  employees: {
    create: (
      companyId: string,
      employee: Partial<Employee>
    ) =>
      ipcRenderer.invoke(
        "employees:create",
        companyId,
        employee
      ),

    uploadPhoto: (
      companyId: string,
      employeeId: string,
      file: {
        name: string;
        buffer: ArrayBuffer;
      }
    ) =>
      ipcRenderer.invoke(
        "employees:uploadPhoto",
        companyId,
        employeeId,
        {
          name: file.name,
          buffer: Buffer.from(file.buffer),
        }
      ),

    getPhotoUrl: (relativePath: string) =>
      ipcRenderer.invoke(
        "photos:getUrl",
        relativePath
      ),

    getAll: (companyId: string) =>
      ipcRenderer.invoke(
        "employees:getAll",
        companyId
      ),

    getById: (
      companyId: string,
      employeeId: string
    ) =>
      ipcRenderer.invoke(
        "employees:getById",
        companyId,
        employeeId
      ),

    update: (
      companyId: string,
      employeeId: string,
      updates: Partial<Employee>
    ) =>
      ipcRenderer.invoke(
        "employees:update",
        companyId,
        employeeId,
        updates
      ),

    delete: (
      companyId: string,
      employeeId: string
    ) =>
      ipcRenderer.invoke(
        "employees:delete",
        companyId,
        employeeId
      ),

    search: (
      companyId: string,
      searchTerm: string
    ) =>
      ipcRenderer.invoke(
        "employees:search",
        companyId,
        searchTerm
      ),
  },

  // ============================================================
  // EMPLOYEE DOCUMENTS
  // ============================================================

  employees_documents: {
    view: (
      companyId: string,
      localPath: string
    ) =>
      ipcRenderer.invoke(
        "employee_documents:view",
        companyId,
        localPath
      ),

    download: (
      companyId: string,
      document: EmployeeDocument
    ) =>
      ipcRenderer.invoke(
        "employee_documents:download",
        companyId,
        document
      ),

    delete: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "employee_documents:delete",
        companyId,
        _id
      ),

    upload: (
      companyId: string,
      document: UploadedEmployeeDocument
    ) =>
      ipcRenderer.invoke(
        "employees-documents:upload",
        companyId,
        document
      ),

    create: (
      companyId: string,
      document: EmployeeDocument
    ) =>
      ipcRenderer.invoke(
        "employees-documents:create",
        companyId,
        document
      ),

    getAll: (
      companyId: string
    ) =>
      ipcRenderer.invoke(
        "employees-documents:get-all",
        companyId
      ),

    getById: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "employees-documents:get-by-id",
        companyId,
        _id
      ),

    getByEmployee: (
      companyId: string,
      employeeId: string
    ) =>
      ipcRenderer.invoke(
        "employees-documents:get-by-employee",
        companyId,
        employeeId
      ),

    getByType: (
      companyId: string,
      employeeId: string,
      documentType: string
    ) =>
      ipcRenderer.invoke(
        "employees-documents:get-by-type",
        companyId,
        employeeId,
        documentType
      ),

    update: (
      companyId: string,
      document: EmployeeDocument
    ) =>
      ipcRenderer.invoke(
        "employees-documents:update",
        companyId,
        document
      ),

    getUnsynced: (
      companyId: string
    ) =>
      ipcRenderer.invoke(
        "employees-documents:get-unsynced",
        companyId
      ),

    markSynced: (
      companyId: string,
      id: string
    ) =>
      ipcRenderer.invoke(
        "employees-documents:mark-synced",
        companyId,
        id
      ),

    upsert: (
      companyId: string,
      document: EmployeeDocument
    ) =>
      ipcRenderer.invoke(
        "employees-documents:upsert",
        companyId,
        document
      ),
  },

  // ============================================================
  // ATTENDANCE
  // ============================================================

  attendance: {
    create: (
      companyId: string,
      input: CreateAttendanceDto
    ) =>
      ipcRenderer.invoke(
        "attendance:create",
        companyId,
        input
      ),

    createAbsenceLeave: (
      companyId: string,
      employeeId: string,
      status: "CONGÉ" | "ABSENT",
      date: string
    ) =>
      ipcRenderer.invoke(
        "attendance:createAbsenceLeave",
        companyId,
        employeeId,
        status,
        date
      ),

    getAll: (
      companyId: string
    ) =>
      ipcRenderer.invoke(
        "attendance:getAll",
        companyId
      ),

    getById: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "attendance:getById",
        companyId,
        _id
      ),

    getByEmployee: (
      companyId: string,
      employeeId: string
    ) =>
      ipcRenderer.invoke(
        "attendance:getByEmployee",
        companyId,
        employeeId
      ),

    getEmployeesWithoutAttendance: (
      companyId: string,
      date: string
    ) =>
      ipcRenderer.invoke(
        "attendance:getEmployeesWithoutAttendance",
        companyId,
        date
      ),

    getByDate: (
      companyId: string,
      date: string
    ) =>
      ipcRenderer.invoke(
        "attendance:getByDate",
        companyId,
        date
      ),

    getAttendanceRecord: (
      companyId: string,
      employeeId: string,
      date: string
    ) =>
      ipcRenderer.invoke(
        "attendance:getAttendanceRecord",
        companyId,
        employeeId,
        date
      ),

    update: (
      companyId: string,
      _id: string,
      date: string,
      updates: Partial<AttendanceWithEmployee>
    ) =>
      ipcRenderer.invoke(
        "attendance:update",
        companyId,
        _id,
        date,
        updates
      ),

    markAbsent: (
      companyId: string,
      date: string
    ) =>
      ipcRenderer.invoke(
        "attendance:mark-absent",
        companyId,
        date
      ),

    delete: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "attendance:delete",
        companyId,
        _id
      ),
  },

  // ============================================================
  // ATTENDANCE DAILY CHECK
  // ============================================================

  attendanceDailyCheck: {
    create: (
      companyId: string,
      input: AttendanceDailyCheckPreparationInput
    ) =>
      ipcRenderer.invoke(
        "attendanceDailyCheck:create",
        companyId,
        input
      ),

    getById: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "attendanceDailyCheck:getById",
        companyId,
        _id
      ),

    getByDate: (
      companyId: string,
      date: string
    ) =>
      ipcRenderer.invoke(
        "attendanceDailyCheck:getByDate",
        companyId,
        date
      ),

    getAll: (
      companyId: string
    ) =>
      ipcRenderer.invoke(
        "attendanceDailyCheck:getAll",
        companyId
      ),

    verify: (
      input: VerifyAttendanceDailyCheckInput
    ) =>
      ipcRenderer.invoke(
        "attendanceDailyCheck:verify",
        input
      ),

    notifyManager: (
      input: MarkManagerNotifiedInput
    ) =>
      ipcRenderer.invoke(
        "attendanceDailyCheck:notifyManager",
        input
      ),

    lock: (
      companyId: string,
      input: LockAttendanceDailyCheckInput
    ) =>
      ipcRenderer.invoke(
        "attendanceDailyCheck:lock",
        companyId,
        input
      ),
  },

  // ============================================================
  // ATTENDANCE REPORTS
  // ============================================================

  attendanceReports: {
    savePdf: (
      companyId: string,
      date: string
    ) =>
      ipcRenderer.invoke(
        "attendance-report:save-pdf",
        companyId,
        date
      ),

    printPdf: (
      companyId: string,
      date: string
    ) =>
      ipcRenderer.invoke(
        "attendance-report:print-pdf",
        companyId,
        date
      ),
  },

  // ============================================================
  // LEAVE
  // ============================================================

  leave: {
    create: (
      companyId: string,
      leave: Partial<Leave>
    ) =>
      ipcRenderer.invoke(
        "leave:create",
        companyId,
        leave
      ),

    getLeaveById: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "leave:getLeaveById",
        companyId,
        _id
      ),

    getLeaveByEmployeeId: (
      companyId: string,
      employeeId: string
    ) =>
      ipcRenderer.invoke(
        "leave:getLeaveByEmployeeId",
        companyId,
        employeeId
      ),

    getOngoingLeaves: (
      companyId: string,
      date: string
    ) =>
      ipcRenderer.invoke(
        "leave:getOnGoing",
        companyId,
        date
      ),

    getLeaveByMonth: (
      companyId: string,
      month: string
    ) =>
      ipcRenderer.invoke(
        "leave:getLeaveByMonth",
        companyId,
        month
      ),

    update: (
      companyId: string,
      _id: string,
      updates: Partial<Leave>
    ) =>
      ipcRenderer.invoke(
        "leave:update",
        companyId,
        _id,
        updates
      ),

    cancel: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "leave:cancel",
        companyId,
        _id
      ),

    delete: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "leave:delete",
        companyId,
        _id
      ),
  },

  // ============================================================
  // TASKS
  // ============================================================

  tasks: {
    create: (
      companyId: string,
      task: Task
    ) =>
      ipcRenderer.invoke(
        "tasks:create",
        companyId,
        task
      ),

    update: (
      companyId: string,
      task: Task
    ) =>
      ipcRenderer.invoke(
        "tasks:update",
        companyId,
        task
      ),

    getAll: (
      companyId: string
    ) =>
      ipcRenderer.invoke(
        "tasks:getAll",
        companyId
      ),

    getById: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "tasks:getById",
        companyId,
        _id
      ),

    getUserTasks: (
      companyId: string,
      userId: string
    ) =>
      ipcRenderer.invoke(
        "tasks:getUserTasks",
        companyId,
        userId
      ),

    getTopTasks: (
      companyId: string,
      userId: string
    ) =>
      ipcRenderer.invoke(
        "tasks:getTopTasks",
        companyId,
        userId
      ),

    delete: (
      companyId: string,
      taskId: string
    ) =>
      ipcRenderer.invoke(
        "tasks:delete",
        companyId,
        taskId
      ),

    onNew: (
      callback: (data: any) => void
    ) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: any
      ) => {
        callback(data);
      };

      ipcRenderer.on(
        "task:new",
        handler
      );

      return () => {
        ipcRenderer.removeListener(
          "task:new",
          handler
        );
      };
    },
  },

  // ============================================================
  // TASK COMMENTS
  // ============================================================

  taskComments: {
    create: (
      companyId: string,
      payload: {
        taskId: string;
        author: string;
        message: string;
      }
    ) =>
      ipcRenderer.invoke(
        "task-comments:create",
        companyId,
        payload
      ),

    getByTaskId: (
      companyId: string,
      taskId: string
    ) =>
      ipcRenderer.invoke(
        "task-comments:get",
        companyId,
        taskId
      ),

    delete: (
      companyId: string,
      commentId: string
    ) =>
      ipcRenderer.invoke(
        "task-comments:delete",
        companyId,
        commentId
      ),
  },

 

  // ============================================================
  // FILE
  // ============================================================

  file: {
    save: (
      data: string
    ) =>
      ipcRenderer.invoke(
        "save-file",
        data
      ),
  },

  // ============================================================
  // SYNC
  // ============================================================

  sync: (
    companyId: string
  ) =>
    ipcRenderer.invoke(
      "sync:run",
      companyId
    ),

  onSyncStatus: (
    callback: (event: SyncStatusEvent) => void
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: SyncStatusEvent
    ) => {
      callback(data);
    };

    ipcRenderer.on(
      "sync:status",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "sync:status",
        listener
      );
    };
  },

  onPendingChanges: (
    callback: (data: {
      pendingChanges: number;
      timestamp: string;
    }) => void
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: {
        pendingChanges: number;
        timestamp: string;
      }
    ) => {
      callback(data);
    };

    ipcRenderer.on(
      "sync:pending-changes",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "sync:pending-changes",
        listener
      );
    };
  },

  // ============================================================
  // PAYROLL SETTINGS
  // ============================================================

  payrollSettings: {
    get: (
      companyId: string
    ) =>
      ipcRenderer.invoke(
        "payroll-settings:get",
        companyId
      ),

    getById: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "payroll-settings:getById",
        companyId,
        _id
      ),

    create: (
      companyId: string,
      data: {
        currency: string;
        workingDays: number;
        workingHours: number;
        paymentDay: number;
      }
    ) =>
      ipcRenderer.invoke(
        "payroll-settings:create",
        companyId,
        data
      ),

    update: (
      companyId: string,
      settings: {
        _id: string;
        currency: string;
        workingDays: number;
        workingHours: number;
        paymentDay: number;
        synced: number;
        createdAt: string;
        updatedAt: string;
        lastSyncedAt?: string;
        isDeleted: number;
      }
    ) =>
      ipcRenderer.invoke(
        "payroll-settings:update",
        companyId,
        settings
      ),

    updateFields: (
      companyId: string,
      _id: string,
      fields: {
        currency?: string;
        workingDays?: number;
        workingHours?: number;
        paymentDay?: number;
      }
    ) =>
      ipcRenderer.invoke(
        "payroll-settings:updateFields",
        companyId,
        _id,
        fields
      ),

    delete: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "payroll-settings:delete",
        companyId,
        _id
      ),

    restore: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "payroll-settings:restore",
        companyId,
        _id
      ),

    markSynced: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "payroll-settings:markSynced",
        companyId,
        _id
      ),

    getUnsynced: (
      companyId: string
    ) =>
      ipcRenderer.invoke(
        "payroll-settings:getUnsynced",
        companyId
      ),
  },

  // ============================================================
  // PAYROLL COMPONENTS
  // ============================================================

  payrollComponents: {
    create: (
      companyId: string,
      component: CreatePayrollComponentDto
    ) =>
      ipcRenderer.invoke(
        "payroll-components:create",
        companyId,
        component
      ),

    getAll: (
      companyId: string,
      type?: "EARNING" | "DEDUCTION"
    ) =>
      ipcRenderer.invoke(
        "payroll-components:getAll",
        companyId,
        type
      ),

    getEnabled: (
      companyId: string,
      type?: "EARNING" | "DEDUCTION"
    ) =>
      ipcRenderer.invoke(
        "payroll-components:getEnabled",
        companyId,
        type
      ),

    getById: (
      companyId: string,
      id: string
    ) =>
      ipcRenderer.invoke(
        "payroll-components:getById",
        companyId,
        id
      ),

    update: (
      companyId: string,
      components: PayrollComponent[]
    ) =>
      ipcRenderer.invoke(
        "payroll-components:update",
        companyId,
        components
      ),

    delete: (
      companyId: string,
      id: string
    ) =>
      ipcRenderer.invoke(
        "payroll-components:delete",
        companyId,
        id
      ),

    enable: (
      companyId: string,
      id: string
    ) =>
      ipcRenderer.invoke(
        "payroll-components:enable",
        companyId,
        id
      ),

    disable: (
      companyId: string,
      id: string
    ) =>
      ipcRenderer.invoke(
        "payroll-components:disable",
        companyId,
        id
      ),

    upsert: (
      companyId: string,
      component: PayrollComponent
    ) =>
      ipcRenderer.invoke(
        "payroll-components:upsert",
        companyId,
        component
      ),

    getUnsynced: (
      companyId: string
    ) =>
      ipcRenderer.invoke(
        "payroll-components:getUnsynced",
        companyId
      ),

    markSynced: (
      companyId: string,
      id: string
    ) =>
      ipcRenderer.invoke(
        "payroll-components:markSynced",
        companyId,
        id
      ),
  },

  // ============================================================
  // PAYROLL EMPLOYEE PROFILES
  // ============================================================

  payrollEmployeeProfiles: {
    create: (
      companyId: string,
      employeeID: string,
      profile: CreatePayrollProfileDto
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:create",
        companyId,
        employeeID,
        profile
      ),

    createMany: (
      companyId: string,
      profiles: CreatePayrollProfileDto[]
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:createMany",
        companyId,
        profiles
      ),

    update: (
      companyId: string,
      profile: EmployeePayrollProfile
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:update",
        companyId,
        profile
      ),

    updateMany: (
      companyId: string,
      profiles: EmployeePayrollProfile[]
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:updateMany",
        companyId,
        profiles
      ),

    upsert: (
      companyId: string,
      profile: EmployeePayrollProfile
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:upsert",
        companyId,
        profile
      ),

    upsertMany: (
      companyId: string,
      profiles: EmployeePayrollProfile[]
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:upsertMany",
        companyId,
        profiles
      ),

    get: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:get",
        companyId,
        _id
      ),

    getAll: (
      companyId: string,
      employeeID?: string,
      type?: "EARNING" | "DEDUCTION"
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:getAll",
        companyId,
        employeeID,
        type
      ),

    getByEmployee: (
      companyId: string,
      employeeId: string
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:getByEmployee",
        companyId,
        employeeId
      ),

    getByComponent: (
      companyId: string,
      employeeId: string,
      componentId: string
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:getByComponent",
        companyId,
        employeeId,
        componentId
      ),

    getUnsynced: (
      companyId: string
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:getUnsynced",
        companyId
      ),

    markSynced: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:markSynced",
        companyId,
        _id
      ),

    markManySynced: (
      companyId: string,
      ids: string[]
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:markManySynced",
        companyId,
        ids
      ),

    delete: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:delete",
        companyId,
        _id
      ),

    restore: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:restore",
        companyId,
        _id
      ),

    permanentlyDelete: (
      companyId: string,
      _id: string
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:permanentlyDelete",
        companyId,
        _id
      ),

    exists: (
      companyId: string,
      employeeId: string,
      componentId: string
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:exists",
        companyId,
        employeeId,
        componentId
      ),

    count: (
      companyId: string
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:count",
        companyId
      ),

    initialize: (
      companyId: string
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:initialize",
        companyId
      ),

    initializeForEmployee: (
      companyId: string,
      employeeId: string
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:initializeForEmployee",
        companyId,
        employeeId
      ),

    addComponentToEmployees: (
      companyId: string,
      component: PayrollComponent
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:addComponentToEmployees",
        companyId,
        component
      ),

    resetToDefaults: (
      companyId: string,
      employeeId: string
    ) =>
      ipcRenderer.invoke(
        "payrollEmployeeProfiles:resetToDefaults",
        companyId,
        employeeId
      ),
  },

  // ============================================================
  // PAYROLL RUN
  // ============================================================

  payrollRun: {
    createPayrollDraft: (
      companyId: string,
      admin: AdminUser,
      year: number,
      month: number
    ) =>
      ipcRenderer.invoke(
        "payroll:createDraft",
        companyId,
        admin,
        year,
        month
      ),

    getPayrollRuns: (
      companyId: string,
      year: number,
      month: number
    ) =>
      ipcRenderer.invoke(
        "payroll:getRuns",
        companyId,
        year,
        month
      ),

    getPayrollRunById: (
      companyId: string,
      id: string
    ) =>
      ipcRenderer.invoke(
        "payroll:getRunById",
        companyId,
        id
      ),

    submitForVerification: (
      companyId: string,
      payrollRunId: string,
      admin: AdminUser
    ) =>
      ipcRenderer.invoke(
        "payroll:submitForVerification",
        companyId,
        payrollRunId,
        admin
      ),

    returnToDraft: (
      companyId: string,
      payrollRunId: string
    ) =>
      ipcRenderer.invoke(
        "payroll:returnToDraft",
        companyId,
        payrollRunId
      ),

    approvePayroll: (
      companyId: string,
      payrollRunId: string,
      adminUser: AdminUser
    ) =>
      ipcRenderer.invoke(
        "payroll:approve",
        companyId,
        payrollRunId,
        adminUser
      ),

    markPayrollAsPaid: (
      companyId: string,
      payrollRunId: string,
      adminUser: AdminUser
    ) =>
      ipcRenderer.invoke(
        "payroll:markAsPaid",
        companyId,
        payrollRunId,
        adminUser
      ),

    cancelPayroll: (
      companyId: string,
      payrollRunId: string,
      admin: AdminUser
    ) =>
      ipcRenderer.invoke(
        "payroll:cancel",
        companyId,
        payrollRunId,
        admin
      ),

    getPayrollResults: (
      companyId: string,
      payrollRunId: string
    ) =>
      ipcRenderer.invoke(
        "payroll:getResults",
        companyId,
        payrollRunId
      ),

    getEmployeePayrollResults: (
      companyId: string,
      employeeId: string,
      payrollRunId?: string
    ) =>
      ipcRenderer.invoke(
        "payroll:getEmployeeResults",
        companyId,
        employeeId,
        payrollRunId
      ),

    getPayrollItems: (
      companyId: string,
      payrollResultId: string,
      employeeId?: string
    ) =>
      ipcRenderer.invoke(
        "payroll:getItems",
        companyId,
        payrollResultId,
        employeeId
      ),

    deletePayrollRun: (
      companyId: string,
      payrollRunId: string
    ) =>
      ipcRenderer.invoke(
        "payroll:deleteRun",
        companyId,
        payrollRunId
      ),
  },

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  notifications: {
    scheduleReminder: (
      message: string,
      remindAt: string
    ) =>
      ipcRenderer.invoke(
        "notifications:schedule-reminder",
        message,
        remindAt
      ),

    cancelReminder: (
      id: string
    ) =>
      ipcRenderer.invoke(
        "notifications:cancel-reminder",
        id
      ),

    cancelAllReminders: () =>
      ipcRenderer.invoke(
        "notifications:cancel-all-reminders"
      ),
  },
}) satisfies Window["electron"];

