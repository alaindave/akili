import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import useAdminUser from "../../../../../store/auth.store";

type UpdateEmployeeInput = {
  companyId: string;
  _id: string;
  data: Parameters<typeof window.electron.employees.update>[2];
};

export const employeeKeys = {
  all: ["employees"] as const,

  list: (companyId: string) => ["employees", "list", { companyId }] as const,

  details: (companyId: string) =>
    ["employees", "detail", { companyId }] as const,

  detail: (companyId: string, employeeId: string) =>
    [
      "employees",
      "detail",
      {
        companyId,
        employeeId,
      },
    ] as const,
};

/**
 * Create employee
 */
export function useCreateEmployee() {
  const queryClient = useQueryClient();

  const companyId = useAdminUser((store) => store.adminUser.companyId);

  return useMutation({
    mutationFn: (
      data: Parameters<typeof window.electron.employees.create>[1]
    ) => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      return window.electron.employees.create(companyId, data);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: employeeKeys.list(companyId),
      });
    },
  });
}

/**
 * Get all employees
 */
export function useEmployees() {
  const companyId = useAdminUser((store) => store.adminUser.companyId);

  return useQuery({
    queryKey: employeeKeys.list(companyId),

    queryFn: () => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      return window.electron.employees.getAll(companyId);
    },

    enabled: Boolean(companyId),
  });
}

/**
 * Get a single employee
 */
export function useEmployee(employeeId?: string) {
  const companyId = useAdminUser((store) => store.adminUser.companyId);

  return useQuery({
    queryKey:
      employeeId && companyId
        ? employeeKeys.detail(companyId, employeeId)
        : employeeKeys.details(companyId),

    queryFn: () => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      if (!employeeId) {
        throw new Error("Employee ID is required");
      }

      return window.electron.employees.getById(companyId, employeeId);
    },

    enabled: Boolean(companyId && employeeId),
  });
}

/**
 * Update employee
 *
 * After the local SQLite update succeeds, the returned employee
 * is immediately written into the React Query detail cache
 * and employee list cache.
 */
export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  const companyId = useAdminUser((store) => store.adminUser.companyId);

  return useMutation({
    mutationFn: ({ companyId, _id, data }: UpdateEmployeeInput) => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      return window.electron.employees.update(companyId, _id, data);
    },

    onSuccess: (updatedEmployee, variables) => {
      if (!updatedEmployee || !companyId) return;

      // Update individual employee cache immediately
      queryClient.setQueryData(
        employeeKeys.detail(companyId, variables._id),
        updatedEmployee
      );

      // Update employee list cache immediately
      queryClient.setQueryData(
        employeeKeys.list(companyId),
        (oldEmployees: (typeof updatedEmployee)[] | undefined) => {
          if (!oldEmployees) return oldEmployees;

          return oldEmployees.map((employee) =>
            employee._id === variables._id ? updatedEmployee : employee
          );
        }
      );
    },
  });
}

/**
 * Delete employee
 */
export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  const companyId = useAdminUser((store) => store.adminUser.companyId);

  return useMutation({
    mutationFn: (employeeId: string) => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      return window.electron.employees.delete(companyId, employeeId);
    },

    onSuccess: (_data, employeeId) => {
      if (!companyId) return;

      queryClient.removeQueries({
        queryKey: employeeKeys.detail(companyId, employeeId),
      });

      queryClient.invalidateQueries({
        queryKey: employeeKeys.list(companyId),
      });
    },
  });
}
