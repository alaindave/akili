import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  Attendance,
  AttendanceWithEmployee,
  CreateAttendanceDto,
} from "../../../../../common/types/attendance/Attendance";

/* =========================================================
   QUERY KEYS
========================================================= */

export const attendanceKeys = {
  all: ["attendance"] as const,

  lists: (companyId: string) =>
    [...attendanceKeys.all, "list", companyId] as const,

  list: (companyId: string) => [...attendanceKeys.lists(companyId)] as const,

  details: (companyId: string) =>
    [...attendanceKeys.all, "detail", companyId] as const,

  detail: (companyId: string, _id: string) =>
    [...attendanceKeys.details(companyId), _id] as const,

  byEmployee: (companyId: string, employeeId: string) =>
    [...attendanceKeys.all, "employee", companyId, employeeId] as const,

  byDate: (companyId: string, date: string) =>
    [...attendanceKeys.all, "date", companyId, date] as const,

  record: (companyId: string, employeeId: string, date: string) =>
    [...attendanceKeys.all, "record", companyId, employeeId, date] as const,

  employeesWithoutAttendance: (companyId: string, date: string) =>
    [...attendanceKeys.all, "without-attendance", companyId, date] as const,
};

/* =========================================================
   QUERIES
========================================================= */

/**
 * Get all attendance records
 */
export const useAttendance = (companyId: string) => {
  return useQuery({
    queryKey: attendanceKeys.list(companyId),

    queryFn: () => window.electron.hr.attendance.getAll(companyId),
  });
};

/**
 * Get attendance record by ID
 */
export const useAttendanceById = (companyId: string, _id: string) => {
  return useQuery({
    queryKey: attendanceKeys.detail(companyId, _id),

    queryFn: () => window.electron.hr.attendance.getById(companyId, _id!),

    enabled: !!_id,
  });
};

/**
 * Get attendance records for an employee
 */
export const useEmployeeAttendance = (
  companyId: string,
  employeeId: string
) => {
  return useQuery({
    queryKey: attendanceKeys.byEmployee(companyId, employeeId),

    queryFn: () =>
      window.electron.hr.attendance.getByEmployee(companyId, employeeId!),

    enabled: !!employeeId,
  });
};

/**
 * Get employees without attendance for a specific date
 */
export const useEmployeesWithoutAttendance = (
  companyId: string,
  date: string
) => {
  return useQuery({
    queryKey: attendanceKeys.employeesWithoutAttendance(companyId, date),

    queryFn: () =>
      window.electron.hr.attendance.getEmployeesWithoutAttendance(
        companyId,
        date!
      ),

    enabled: !!date,
  });
};

/**
 * Get attendance records for a specific date
 */
export const useAttendanceByDate = (companyId: string, date: string) => {
  return useQuery({
    queryKey: attendanceKeys.byDate(companyId, date),

    queryFn: (): Promise<AttendanceWithEmployee[]> =>
      window.electron.hr.attendance.getByDate(companyId, date),

    enabled: !!date,
  });
};

/**
 * Get a specific employee's attendance record for a date
 */
export const useAttendanceRecord = (
  companyId: string,
  employeeId: string,
  date: string
) => {
  return useQuery({
    queryKey: attendanceKeys.record(companyId, employeeId, date),

    queryFn: () =>
      window.electron.hr.attendance.getAttendanceRecord(
        companyId,
        employeeId!,
        date!
      ),

    enabled: !!employeeId && !!date,
  });
};

/* =========================================================
   MUTATIONS
========================================================= */

/**
 * Create normal attendance
 */
export const useCreateAttendance = (companyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAttendanceDto) =>
      window.electron.hr.attendance.create(companyId, input),

    onSuccess: (createdAttendance, input) => {
      /*
       * Immediately update the individual employee/date cache.
       */
      if (input.employeeId && input.date) {
        queryClient.setQueryData(
          attendanceKeys.record(companyId, input.employeeId, input.date),
          createdAttendance
        );
      }

      /*
       * Refresh all attendance lists in the background.
       */
      queryClient.invalidateQueries({
        queryKey: attendanceKeys.all,
      });
    },
  });
};

/**
 * Create ABSENT / CONGÉ attendance
 */
export const useCreateAbsenceLeave = (companyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employeeId,
      status,
      date,
    }: {
      employeeId: string;
      status: "CONGÉ" | "ABSENT";
      date: string;
    }) =>
      window.electron.hr.attendance.createAbsenceLeave(
        companyId,
        employeeId,
        status,
        date
      ),

    onSuccess: (createdAttendance, variables) => {
      /*
       * Immediately update the employee/date record.
       */
      queryClient.setQueryData(
        attendanceKeys.record(companyId, variables.employeeId, variables.date),
        createdAttendance
      );

      /*
       * Refresh related attendance data.
       */
      queryClient.invalidateQueries({
        queryKey: attendanceKeys.all,
      });

      queryClient.invalidateQueries({
        queryKey: attendanceKeys.employeesWithoutAttendance(
          companyId,
          variables.date
        ),
      });
    },
  });
};

/**
 * Update attendance
 *
 * IMPORTANT:
 * The updated record is written directly into every
 * relevant React Query cache before the background
 * invalidation/refetch.
 *
 * This makes clock-in / clock-out / notes updates appear
 * immediately across the application.
 */
export const useUpdateAttendance = (companyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      _id,
      date,
      updates,
    }: {
      _id: string;
      employeeId: string;
      date: string;
      updates: Partial<AttendanceWithEmployee>;
    }) => window.electron.hr.attendance.update(companyId, _id, date, updates),

    onSuccess: (updatedAttendance: AttendanceWithEmployee, variables) => {
      if (!updatedAttendance) return;
      const employeeId = updatedAttendance.employeeId ?? variables.employeeId;

      /*
       * -------------------------------------------------------
       * SINGLE ATTENDANCE
       * -------------------------------------------------------
       */

      queryClient.setQueryData(
        attendanceKeys.detail(companyId, variables._id),
        updatedAttendance
      );

      /*
       * -------------------------------------------------------
       * EMPLOYEE + DATE RECORD
       * -------------------------------------------------------
       */

      if (employeeId) {
        queryClient.setQueryData(
          attendanceKeys.record(companyId, employeeId, variables.date),
          updatedAttendance
        );
      }

      /*
       * -------------------------------------------------------
       * ATTENDANCE BY DATE
       * -------------------------------------------------------
       */

      queryClient.setQueryData<AttendanceWithEmployee[]>(
        attendanceKeys.byDate(companyId, variables.date),
        (old) => {
          if (!old) return old;

          return old.map((item) =>
            item._id === variables._id
              ? {
                  ...item,
                  ...updatedAttendance,
                }
              : item
          );
        }
      );

      /*
       * -------------------------------------------------------
       * ATTENDANCE BY EMPLOYEE
       * -------------------------------------------------------
       */

      if (employeeId) {
        queryClient.setQueryData<AttendanceWithEmployee[]>(
          attendanceKeys.byEmployee(companyId, employeeId),
          (old) => {
            if (!old) return old;

            return old.map((item) =>
              item._id === variables._id ? updatedAttendance : item
            );
          }
        );
      }

      /*
       * -------------------------------------------------------
       * ALL ATTENDANCE
       * -------------------------------------------------------
       */

      queryClient.setQueryData<AttendanceWithEmployee[]>(
        attendanceKeys.list(companyId),
        (old) => {
          if (!old) return old;

          return old.map((item) =>
            item._id === variables._id
              ? {
                  ...item,
                  ...updatedAttendance,
                }
              : item
          );
        }
      );
      /*
       * IMPORTANT:
       *
       * Do NOT do this here:
       *
       * queryClient.invalidateQueries({
       *   queryKey: attendanceKeys.all,
       * });
       *
       * That refetch is what can cause the list to jump and
       * Editable to lose its focus.
       */
    },
  });
};

/**
 * Mark employees absent for a date
 */
export const useMarkAbsent = (companyId: string, date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (): Promise<{
      companyId: string;
      absentAttendance: any;
      source: "AUTO_SERVER" | "LOCAL" | "SKIPPED";
      completed: boolean;
      timestamp: string;
    }> => window.electron.hr.attendance.markAbsent(companyId, date),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attendanceKeys.all,
      });

      queryClient.invalidateQueries({
        queryKey: attendanceKeys.byDate(companyId, date),
      });

      queryClient.invalidateQueries({
        queryKey: attendanceKeys.employeesWithoutAttendance(companyId, date),
      });
    },
  });
};

/**
 * Delete attendance
 */
export const useDeleteAttendance = (companyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (_id: string) =>
      window.electron.hr.attendance.delete(companyId, _id),

    onSuccess: (_, _id) => {
      /*
       * Remove individual detail cache.
       */
      queryClient.removeQueries({
        queryKey: attendanceKeys.detail(companyId, _id),
      });

      /*
       * Refresh all attendance lists.
       */
      queryClient.invalidateQueries({
        queryKey: attendanceKeys.all,
      });
    },
  });
};
