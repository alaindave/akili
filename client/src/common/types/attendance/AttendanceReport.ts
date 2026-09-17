export type DailyAttendanceEmployee = {
  employeeId: string;
  matricule: string;
  firstName?: string;
  lastName?: string;
  department?: string | null;
  role?: string | null;
  clockIn?: string | null;
  clockOut?: string | null;
  status: "PONCTUEL" | "RETARD" | "ABSENT" | "CONGÉ" | string;
};

export type DailyAttendanceReport = {
  company: {
    name: string;
    logo?: string | null;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  date: string;
  employees: DailyAttendanceEmployee[];
};
