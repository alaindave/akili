import { create } from "zustand";
import type { AppModule } from "../common/types/task/Task";

export const dashboardTaskScope = (companyId: string, userId: string, module: AppModule) =>
  JSON.stringify([companyId, userId, module]);

interface DashboardTasksStore {
  dismissed: Record<string, string[]>;
  dismiss: (scope: string, id: string) => void;
  restore: (scope: string) => void;
}

// Dashboard dismissal is session UI state, independent of synced task records.
const useDashboardTasksStore = create<DashboardTasksStore>((set) => ({
  dismissed: {},
  dismiss: (scope, id) => set(state => ({
    dismissed: {
      ...state.dismissed,
      [scope]: [...new Set([...(state.dismissed[scope] ?? []), id])],
    },
  })),
  restore: scope => set(state => ({ dismissed: { ...state.dismissed, [scope]: [] } })),
}));

export default useDashboardTasksStore;
