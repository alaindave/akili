import express, { Request, Response } from "express";

import supabase from "../services/supabase.service.js";
import Employee from "../models/employee.model.js";

const router = express.Router();

interface EmployeeParams {
  employeeId: string;
}

router.get(
  "/:employeeId",
  async (req: Request<EmployeeParams>, res: Response) => {
    try {
      const { employeeId } = req.params;

      const employee = await Employee.findById(employeeId);

      if (!employee) {
        return res.status(404).json({
          message: "Employee not found",
        });
      }

      if (!employee.photo_path) {
        return res.status(404).json({
          message: "Employee photo path not found",
        });
      }

      const { data, error } = await supabase.storage
        .from("employees_photos")
        .download(employee.photo_path);

      if (error || !data) {
        return res.status(404).json({
          message: "Photo not found",
        });
      }

      const buffer = Buffer.from(await data.arrayBuffer());

      res.setHeader("Content-Type", data.type || "application/octet-stream");

      res.setHeader("Cache-Control", "public, max-age=3600");

      return res.status(200).send(buffer);
    } catch (err) {
      console.error("FAILED TO DOWNLOAD PHOTO:", err);

      return res.status(500).json({
        message: "FAILED TO DOWNLOAD PHOTO",
      });
    }
  }
);

export default router;
