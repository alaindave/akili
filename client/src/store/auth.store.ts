import { create } from "zustand";
import { persist } from "zustand/middleware";
import OfflineUser from "../common/types/OfflineUser";

interface AdminUserStore {
  adminUser: Omit<OfflineUser, "password">;
  isAuthenticated: boolean;

  login: (user: Omit<OfflineUser, "password">) => void;

  logout: () => void;

  saveNotes: (notes: string) => void;
}

const emptyAdminUser = {} as OfflineUser;

const useAdminUser = create<AdminUserStore>()(
  persist(
    (set) => ({
      adminUser: emptyAdminUser,
      isAuthenticated: false,

      login: (user) => {
        set({
          adminUser: user,
          isAuthenticated: true,
        });
      },

      logout: () =>
        set({
          adminUser: emptyAdminUser,
          isAuthenticated: false,
        }),

      saveNotes: (notes: string) =>
        set((state) => ({
          adminUser: {
            ...state.adminUser,
            notes,
          },
        })),
    }),
    {
      name: "employee-auth",
    }
  )
);

export default useAdminUser;
