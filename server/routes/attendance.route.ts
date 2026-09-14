import express, { Request, Response } from "express";
import mongoose from "mongoose";
import { validate as isUUID } from "uuid";
import {
  getEmployee,
  addAttendance,
  getAttendance,
  getAttendanceByDate,
  getAttendanceByEmployeeID,
  editAttendance,
  deleteAttendance,
} from "../db.js";
import { markAbsentEmployeesHandler } from "../controllers/attendance.controller.js";

const router = express.Router();

interface EmployeeParams {
  employeeId: string;
}

interface AttendanceParams {
  attendanceId: string;
}

interface DateQuery {
  date?: string;
}

//Mark employees absent
router.post("/mark-absent", markAbsentEmployeesHandler);

// Add attendance
router.post(
  "/:employeeId",
  async (req: Request<EmployeeParams>, res: Response) => {
    try {
      const employee = await getEmployee(req.params.employeeId);

      if (!employee) {
        return res.status(404).send("No employee found with the given ID.");
      }

      const attendance = await getAttendanceByEmployeeID(req.params.employeeId);

      if (attendance) {
        return res.status(409).send("The employee has already clocked in");
      }

      console.log("EMPLOYEE INFO-ATTENDANCE:", employee);
      console.log("SUBMITTED CLOCK IN TIME:", req.body.clockIn);

      const attendanceReport = await addAttendance(
        req.params.employeeId,
        req.body.clockIn
      );

      console.log("EMPLOYEE ATTENDANCE REPORT:", attendanceReport);

      return res.status(200).send(attendanceReport);
    } catch (error) {
      console.error("AN ERROR OCCURED DURING ATTENDANCE ENTRY:", error);

      return res.status(500).send(error);
    }
  }
);

// Get attendances by date
router.get("/", async (req: Request<{}, {}, {}, DateQuery>, res: Response) => {
  console.log("Fetch all attendances for date:", req.query.date);

  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).send("Date is required");
    }

    const attendances = await getAttendanceByDate(date);

    console.log("Fetched attendances by date:", attendances);

    return res.send(attendances);
  } catch (error) {
    console.error(
      "An error occurred while retrieving attendances by date:",
      error
    );

    return res.status(500).send("Server error");
  }
});

// Get daily attendance by employee ID
router.get(
  "/:employeeId",
  async (req: Request<EmployeeParams>, res: Response) => {
    try {
      if (!isUUID(req.params.employeeId)) {
        return res.status(400).send("Invalid employee ID");
      }

      const attendance = await getAttendanceByEmployeeID(req.params.employeeId);

      if (!attendance) {
        return res
          .status(404)
          .send("No attendance with the given employee ID found!");
      }

      console.log("Retrieved attendance:", attendance);

      return res.status(200).send(attendance);
    } catch (error) {
      console.error(
        "Unable to retrieve attendance by employee ID. Error:",
        error
      );

      return res.status(500).send(error);
    }
  }
);

// Edit attendance
router.put(
  "/:attendanceId",
  async (req: Request<AttendanceParams>, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.attendanceId)) {
        return res.status(400).send("Invalid attendance ID");
      }

      const attendance = await getAttendance(req.params.attendanceId);

      if (!attendance) {
        return res.status(404).send("No attendance found with the given ID.");
      }

      console.log("Attendance to edit:", attendance);

      const attendanceEdit = await editAttendance(
        req.params.attendanceId,
        req.body
      );

      console.log("Attendance edit success:", attendanceEdit);

      return res.status(200).send(attendanceEdit);
    } catch (error) {
      console.error("Attendance edit error:", error);

      return res.status(500).send("Unable to edit attendance");
    }
  }
);

// Delete attendance
router.delete(
  "/:attendanceId",
  async (req: Request<AttendanceParams>, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.attendanceId)) {
        return res.status(400).send("Invalid attendance ID");
      }

      const attendance = await getAttendance(req.params.attendanceId);

      if (!attendance) {
        return res.status(404).send("No attendance found with the given ID.");
      }

      console.log("Attendance to delete:", attendance);

      const attendanceDeleted = await deleteAttendance(req.params.attendanceId);

      console.log("Attendance delete success:", attendanceDeleted);

      return res.status(200).send(attendanceDeleted);
    } catch (error) {
      console.error("Attendance deletion error:", error);

      return res.status(500).send("Unable to delete attendance");
    }
  }
);

export default router;
