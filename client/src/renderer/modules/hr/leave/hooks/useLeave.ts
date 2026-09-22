import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type Leave from "../../../../../common/types/leave/Leave";

/* =========================================================
   QUERY KEYS
========================================================= */

export const leaveKeys = {
  all: ["leaves"] as const,

  lists: (companyId: string) => [...leaveKeys.all, "list", companyId] as const,

  details: (companyId: string) =>
    [...leaveKeys.all, "detail", companyId] as const,

  detail: (companyId: string, leaveId: string) =>
    [...leaveKeys.details(companyId), leaveId] as const,

  byEmployee: (companyId: string, employeeId: string) =>
    [...leaveKeys.all, "employee", companyId, employeeId] as const,

  ongoing: (companyId: string, date: string) =>
    [...leaveKeys.all, "ongoing", companyId, date] as const,

  byMonth: (companyId: string, month: string) =>
    [...leaveKeys.all, "month", companyId, month] as const,
};

/* =========================================================
   GET LEAVE BY ID
========================================================= */

export const useLeave = (companyId: string, leaveId: string) => {
  return useQuery({
    queryKey: leaveKeys.detail(companyId, leaveId),

    queryFn: async () => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      if (!leaveId) {
        throw new Error("Leave ID is required");
      }

      return window.electron.hr.leave.getLeaveById(companyId, leaveId);
    },

    enabled: Boolean(companyId && leaveId),

    staleTime: 30_000,
  });
};

/* =========================================================
   GET LEAVES BY EMPLOYEE
========================================================= */

export const useEmployeeLeaves = (companyId: string, employeeId: string) => {
  return useQuery({
    queryKey: leaveKeys.byEmployee(companyId, employeeId),

    queryFn: async () => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      if (!employeeId) {
        throw new Error("Employee ID is required");
      }

      return window.electron.hr.leave.getLeaveByEmployeeId(
        companyId,
        employeeId
      );
    },

    enabled: Boolean(companyId && employeeId),

    staleTime: 30_000,
  });
};

/* =========================================================
   GET ONGOING LEAVES
========================================================= */

export const useOngoingLeaves = (companyId: string, date: string) => {
  return useQuery({
    queryKey: leaveKeys.ongoing(companyId, date),

    queryFn: async () => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      if (!date) {
        throw new Error("Date is required");
      }

      return window.electron.hr.leave.getOngoingLeaves(companyId, date);
    },

    enabled: Boolean(companyId && date),

    staleTime: 15_000,
  });
};

/* =========================================================
   GET LEAVES BY MONTH
========================================================= */

export const useLeavesByMonth = (companyId: string, month: string) => {
  return useQuery({
    queryKey: leaveKeys.byMonth(companyId, month),

    queryFn: async () => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      if (!month) {
        throw new Error("Month is required");
      }

      return window.electron.hr.leave.getLeaveByMonth(companyId, month);
    },

    enabled: Boolean(companyId && month),

    staleTime: 30_000,
  });
};

/* =========================================================
   CREATE LEAVE
========================================================= */

export const useCreateLeave = (companyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      leave: Pick<
        Leave,
        | "managerEmail"
        | "employeeId"
        | "employeeFirstName"
        | "employeeLastName"
        | "startDate"
        | "endDate"
        | "notes"
        | "subject"
        | "status"
      >
    ) => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      return window.electron.hr.leave.create(companyId, leave);
    },

    onSuccess: async (createdLeave) => {
      if (!createdLeave) {
        return;
      }

      /*
       * Cache the newly created leave.
       */
      if (createdLeave._id) {
        queryClient.setQueryData(
          leaveKeys.detail(companyId, createdLeave._id),
          createdLeave
        );
      }

      /*
       * Refresh employee-specific leaves.
       */
      if (createdLeave.employeeId) {
        await queryClient.invalidateQueries({
          queryKey: leaveKeys.byEmployee(companyId, createdLeave.employeeId),
        });
      }

      /*
       * Refresh ongoing leaves.
       */
      if (createdLeave.date) {
        await queryClient.invalidateQueries({
          queryKey: leaveKeys.ongoing(companyId, createdLeave.date),
        });
      }

      /*
       * Refresh monthly leaves.
       */
      await queryClient.invalidateQueries({
        queryKey: [...leaveKeys.all, "month", companyId],
      });

      /*
       * Refresh general leave lists.
       */
      await queryClient.invalidateQueries({
        queryKey: leaveKeys.lists(companyId),
      });
    },
  });
};

/* =========================================================
   UPDATE LEAVE
========================================================= */

export const useUpdateLeave = (companyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      _id,
      updates,
    }: {
      _id: string;
      updates: Partial<Leave>;
    }) => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      if (!_id) {
        throw new Error("eave ID is required");
      }

      return window.electron.hr.leave.update(companyId, _id, updates);
    },

    onSuccess: async (updatedLeave, variables) => {
      if (!updatedLeave) {
        return;
      }

      /*
       * Update the individual leave immediately.
       */
      queryClient.setQueryData(
        leaveKeys.detail(companyId, variables._id),
        updatedLeave
      );

      /*
       * Refresh employee leaves.
       */
      if (updatedLeave.employeeId) {
        await queryClient.invalidateQueries({
          queryKey: leaveKeys.byEmployee(companyId, updatedLeave.employeeId),
        });
      }

      /*
       * Refresh ongoing leaves.
       */
      if (updatedLeave.date) {
        await queryClient.invalidateQueries({
          queryKey: leaveKeys.ongoing(companyId, updatedLeave.date),
        });
      }

      /*
       * Refresh monthly leaves.
       */
      await queryClient.invalidateQueries({
        queryKey: [...leaveKeys.all, "month", companyId],
      });

      /*
       * Refresh general lists.
       */
      await queryClient.invalidateQueries({
        queryKey: leaveKeys.lists(companyId),
      });
    },
  });
};

/* =========================================================
   CANCEL LEAVE
========================================================= */

export const useCancelLeave = (companyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leaveId: string) => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      if (!leaveId) {
        throw new Error("Leave ID is required");
      }

      return window.electron.hr.leave.cancel(companyId, leaveId);
    },

    onSuccess: async (cancelledLeave, leaveId) => {
      /*
       * Update individual leave cache.
       */
      if (cancelledLeave) {
        queryClient.setQueryData(
          leaveKeys.detail(companyId, leaveId),
          cancelledLeave
        );

        /*
         * Refresh employee leaves.
         */
        if (cancelledLeave.employeeId) {
          await queryClient.invalidateQueries({
            queryKey: leaveKeys.byEmployee(
              companyId,
              cancelledLeave.employeeId
            ),
          });
        }

        /*
         * Refresh ongoing leaves.
         */
        if (cancelledLeave.date) {
          await queryClient.invalidateQueries({
            queryKey: leaveKeys.ongoing(companyId, cancelledLeave.date),
          });
        }
      }

      /*
       * Cancellation changes monthly results.
       */
      await queryClient.invalidateQueries({
        queryKey: [...leaveKeys.all, "month", companyId],
      });

      /*
       * Refresh general lists.
       */
      await queryClient.invalidateQueries({
        queryKey: leaveKeys.lists(companyId),
      });
    },
  });
};

/* =========================================================
   DELETE LEAVE
========================================================= */

export const useDeleteLeave = (companyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leaveId: string) => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      if (!leaveId) {
        throw new Error("Leave ID is required");
      }

      return window.electron.hr.leave.delete(companyId, leaveId);
    },

    onSuccess: async (_result, leaveId) => {
      /*
       * Remove the deleted leave from its
       * individual cache.
       */
      queryClient.removeQueries({
        queryKey: leaveKeys.detail(companyId, leaveId),
      });

      await queryClient.invalidateQueries({
        queryKey: leaveKeys.lists(companyId),
      });

      await queryClient.invalidateQueries({
        queryKey: [...leaveKeys.all, "employee", companyId],
      });

      await queryClient.invalidateQueries({
        queryKey: [...leaveKeys.all, "ongoing", companyId],
      });

      await queryClient.invalidateQueries({
        queryKey: [...leaveKeys.all, "month", companyId],
      });
    },
  });
};
