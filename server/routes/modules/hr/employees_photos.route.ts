import express, { Request, Response } from "express";

import supabase from "../../../services/supabase.service.js";
import Employee from "../../../models/modules/hr/employee.model.js";

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

      let { data, error } = await supabase.storage
        .from("employees_photos")
        .download(employee.photo_path);

      // Older employee edits could replace the cloud path with a local filename.
      // The upload handler stores photos under this versioned path.
      if (error || !data) {
        const extensions: Record<string, string> = {
          "image/png": ".png",
          "image/webp": ".webp",
          "image/gif": ".gif",
        };
        const extension = extensions[employee.photo_mime_type ?? ""] ?? ".jpg";
        const cloudPath = `${employee.companyId}/${employee._id}/photo_v${employee.photo_version}${extension}`;
        if (cloudPath !== employee.photo_path) {
          ({ data, error } = await supabase.storage
            .from("employees_photos")
            .download(cloudPath));
        }
      }

      if (error || !data) {
        return res.status(404).json({
          message: "Photo not found",
        });
      }

      const buffer = Buffer.from(await data.arrayBuffer());

      res.setHeader("Content-Type", data.type || "application/octet-stream");

      res.setHeader("Cache-Control", "no-cache");

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
