type TimeOffWithEmployee = import("../../../common/types/hr/time-off/TimeOff", { with: { "resolution-mode": "require" } }).TimeOffWithEmployee;
type Leave = import("../../../common/types/hr/time-off/TimeOff", {
  with: { "resolution-mode": "require" },
}).default;
import { invoke } from "../../ipc/ipc.cjs";

export const leaveApi = {
  create: (
    companyId: string,
    leave: Pick<
      Leave,
      | "employeeId"
      | "startDate"
      | "endDate"
      | "notes"
      | "motifId"
      | "status"
    >
  ) => invoke("leave:create", companyId, leave),

  getLeaveById: (companyId: string, _id: string) =>
    invoke("leave:getLeaveById", companyId, _id),

  getLeaveByEmployeeId: (companyId: string, employeeId: string): Promise<TimeOffWithEmployee[]> =>
    invoke("leave:getLeaveByEmployeeId", companyId, employeeId),

  getOngoingLeaves: (companyId: string, date: string): Promise<TimeOffWithEmployee[]> =>
    invoke("leave:getOnGoing", companyId, date),

  getLeaveByMonth: (companyId: string, month: string): Promise<TimeOffWithEmployee[]> =>
    invoke("leave:getLeaveByMonth", companyId, month),

  update: (companyId: string, _id: string, updates: Partial<Leave>) =>
    invoke("leave:update", companyId, _id, updates),

  cancel: (companyId: string, _id: string) =>
    invoke("leave:cancel", companyId, _id),

  delete: (companyId: string, _id: string) =>
    invoke("leave:delete", companyId, _id),
};
