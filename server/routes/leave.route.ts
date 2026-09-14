import express, { Request, Response } from "express";

import {
  getEmployee,
  addLeave,
  getLeavesByMonth,
  getOnGoingLeaves,
  getLeaveByID,
  getPendingLeaves,
  editLeave,
  deleteLeave,
} from "../db.js";

const router = express.Router();

interface EmployeeParams {
  employeeId: string;
}

interface LeaveParams {
  leaveId: string;
}

interface LeaveQuery {
  month?: string;
  year?: string;
}

export interface LeaveRequestBody {
  managerEmail: string;
  startDate: Date;
  endDate: Date;
  notes: string;
  subject: string;
}

// Add leave
router.post(
  "/:employeeId",
  async (req: Request<EmployeeParams, {}, LeaveRequestBody>, res: Response) => {
    try {
      const employee = await getEmployee(req.params.employeeId);

      console.log("EMPLOYEE INFO:", employee);

      if (!employee) {
        return res.status(404).send("No employee found with the given ID.");
      }

      const pendingLeaves = await getPendingLeaves(req.params.employeeId);

      console.log("PENDING LEAVES:", pendingLeaves);

      if (pendingLeaves.length !== 0) {
        return res
          .status(400)
          .send("There is a pending leave request for this employee!");
      }

      const { startDate, endDate, notes, subject } = req.body;

      const leave = await addLeave(
        req.params.employeeId,
        startDate,
        endDate,
        subject,
        notes
      );

      console.log("EMPLOYEE LEAVE SUCCESS:", leave);
      return res.status(200).send(leave);
    } catch (error) {
      console.error("UNABLE TO SAVE LEAVE:", error);
      return res.status(500).send(error);
    }
  }
);

// Get leaves by submission month
router.get("/", async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).send("The month and year are required");
    }

    const monthNumber = Number(month);
    const yearNumber = Number(year);

    if (isNaN(monthNumber) || isNaN(yearNumber)) {
      return res.status(400).send("Invalid month or year");
    }

    const leaves = await getLeavesByMonth(monthNumber, yearNumber);

    res.send(leaves);
  } catch (error) {
    console.error("Error retrieving leaves:", error);
    res.status(500).send("Server error");
  }
});

// Fetch ongoing leaves
router.get("/ongoing", async (req: Request, res: Response) => {
  try {
    const onGoingLeaves = await getOnGoingLeaves();

    console.log("Fetched ongoing leaves", onGoingLeaves);

    return res.status(200).send(onGoingLeaves);
  } catch (error) {
    console.error("An error occurred while fetching ongoing leaves:", error);

    return res.status(500).send("Server error");
  }
});

// Fetch leave by ID
router.get("/:leaveId", async (req: Request<LeaveParams>, res: Response) => {
  try {
    const leave = await getLeaveByID(req.params.leaveId);

    console.log("Leave fetched:", leave);

    return res.status(200).send(leave);
  } catch (error) {
    console.error("An error occurred while fetching leave:", error);

    return res.status(500).send("Server error");
  }
});

// Edit leave
router.put("/:leaveId", async (req: Request<LeaveParams>, res: Response) => {
  try {
    const leave = await getLeaveByID(req.params.leaveId);

    if (!leave) {
      return res.status(404).send("No leave found with the given ID.");
    }

    console.log("Leave to edit:", leave);

    const leaveEdit = await editLeave(req.params.leaveId, req.body);

    console.log("Leave edit success:", leaveEdit);

    return res.status(200).send(leaveEdit);
  } catch (error) {
    console.error("Leave edit error:", error);

    return res.status(500).send("Unable to edit leave");
  }
});

// Delete leave
router.delete("/:leaveId", async (req: Request<LeaveParams>, res: Response) => {
  try {
    const leave = await getLeaveByID(req.params.leaveId);

    if (!leave) {
      return res.status(404).send("No leave found with the given ID.");
    }

    console.log("Leave to delete:", leave);

    const leaveDeleted = await deleteLeave(req.params.leaveId);

    console.log("Leave delete success:", leaveDeleted);

    return res.status(200).send(leaveDeleted);
  } catch (error) {
    console.error("Deletion request to database failed:", error);

    return res.status(500).send("Leave deletion error");
  }
});

export default router;
