import type { Request, Response } from "express";
import { markAbsentEmployees } from "../services/markEmployeeAbsent.service.js";

export async function markAbsentEmployeesHandler(req: Request, res: Response) {
  const { date } = req.body;
  const companyId = req.headers["x-company-id"];
  console.log("ABSENCE SERVICE ROUTE HIT.CID:", companyId);

  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Company ID is required",
    });
  }

  try {
    const result = await markAbsentEmployees(companyId, date);

    console.log("MARK ABSENT SUCCESS", result);

    return res.status(200).json({
      success: true,
      message: "Employés absents marqués avec succès",
      data: result,
    });
  } catch (error) {
    console.error("ERROR MARKING EMPLOYEES ABSENT:", error);

    return res.status(500).json({
      success: false,
      message: "Impossible de marquer les employés absents",
    });
  }
}
