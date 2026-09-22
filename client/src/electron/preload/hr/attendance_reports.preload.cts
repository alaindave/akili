import { invoke } from "../../ipc/ipc.cjs";

export const attendanceReportsApi = {
  savePdf: (companyId: string, date: string) =>
    invoke("attendance-report:save-pdf", companyId, date),
};
