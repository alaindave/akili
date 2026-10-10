import express, { Request, Response } from "express";
import mongoose from "mongoose";

import {
  getEmployees,
  getEmployee,
  addEmployee,
  updateEmployee,
  deleteEmployee,
} from "../../../db.js";

const router = express.Router();

interface EmployeeParams {
  _id: string;
}

// Get all employees
router.get("/", async (req: Request, res: Response) => {
  try {
    const employees = await getEmployees();

    if (!employees) {
      return res.status(404).send("No employees found");
    }

    console.log("Employees fetched:", employees);

    return res.status(200).send(employees);
  } catch (error) {
    console.error("Unable to retrieve employees. Error:", error);

    return res.status(500).send(error);
  }
});

// Add an employee
router.post("/", async (req: Request, res: Response) => {
  try {
    const employee = await addEmployee(req.body);

    console.log("Added employee:", employee);

    return res.status(200).send(employee);
  } catch (error) {
    console.error("Unable to add the employee. Error:", error);

    return res.status(500).send(error);
  }
});

// Get an employee by ID
router.get("/:_id", async (req: Request<EmployeeParams>, res: Response) => {
  console.log("ID of employee to fetch:", req.params._id);

  try {
    // Remove this check if you use UUID string IDs
    if (!mongoose.Types.ObjectId.isValid(req.params._id)) {
      return res.status(400).send("Invalid employee ID");
    }

    const employee = await getEmployee(req.params._id);

    if (!employee) {
      return res.status(404).send("No employee found with the given ID.");
    }

    console.log("Fetched employee:", employee);

    return res.status(200).send(employee);
  } catch (error) {
    console.error("An error occurred while fetching employee:", error);

    return res.status(500).send(error);
  }
});

// Update an employee
router.put("/:_id", async (req: Request<EmployeeParams>, res: Response) => {
  try {
    // Remove this check if you use UUID string IDs
    if (!mongoose.Types.ObjectId.isValid(req.params._id)) {
      return res.status(400).send("Invalid employee ID");
    }

    const employee = await getEmployee(req.params._id);

    if (!employee) {
      return res.status(404).send("No employee found with the given ID.");
    }

    console.log("Employee to update:", employee);
    console.log("Info to modify:", req.body);

    const updatedEmployee = await updateEmployee(req.params._id, req.body);

    console.log("Updated employee:", updatedEmployee);

    return res.status(200).send(updatedEmployee);
  } catch (error) {
    console.error("An error occurred while updating the employee:", error);

    return res.status(500).send(error);
  }
});

// Delete an employee
router.delete("/:_id", async (req: Request<EmployeeParams>, res: Response) => {
  try {
    // Remove this check if you use UUID string IDs
    if (!mongoose.Types.ObjectId.isValid(req.params._id)) {
      return res.status(400).send("Invalid employee ID");
    }

    const employee = await getEmployee(req.params._id);

    if (!employee) {
      return res.status(404).send("No employee found with the given ID.");
    }

    const result = await deleteEmployee(req.params._id);

    return res.status(204).send(result);
  } catch (error) {
    console.error("An error occurred while deleting employee:", error);

    return res.status(500).send(error);
  }
});

export default router;
