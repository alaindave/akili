import type Leave from "./Leave.js";

export interface LeaveWithEmployee extends Leave {
  firstName: string;
  lastName: string;
  employeeId: string;
  remainingLeave: number;
  role: string;
  department: string;
}
