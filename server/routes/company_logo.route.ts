import express, { Request, Response } from "express";
import supabase from "../services/supabase.service.js";
import Company from "../models/company.model.js";

const router = express.Router();

interface CompanyParams {
  companyId: string;
}

router.get(
  "/:companyId",
  async (req: Request<CompanyParams>, res: Response) => {
    try {
      const { companyId } = req.params;
      const company = await Company.findOne({ companyId });

      if (!company) {
        return res.status(404).json({
          message: "Company not found",
        });
      }

      if (!company.logoPath) {
        return res.status(404).json({
          message: "Company logo path not found",
        });
      }

      const { data, error } = await supabase.storage
        .from("company_logos")
        .download(company.logoPath);

      if (error || !data) {
        console.error("COMPANY LOGO NOT FOUND:", {
          companyId,
          logoPath: company.logoPath,
          error,
        });

        return res.status(404).json({
          message: "Company logo not found",
        });
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      res.setHeader("Content-Type", data.type || "application/octet-stream");
      res.setHeader("Cache-Control", "public, max-age=3600");

      return res.status(200).send(buffer);
    } catch (err) {
      console.error("FAILED TO DOWNLOAD COMPANY LOGO:", err);
      return res.status(500).json({
        message: "FAILED TO DOWNLOAD COMPANY LOGO",
      });
    }
  }
);

export default router;
