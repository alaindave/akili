import express, { Request, Response } from "express";

import EmployeeDocument from "../models/employeesDocuments.model.js";
import supabase from "../services/supabase.service.js";

const router = express.Router();

interface DocumentParams {
  documentId: string;
}

router.get(
  "/:documentId",
  async (req: Request<DocumentParams>, res: Response) => {
    console.log("DOCUMENT API END POINT HIT");

    try {
      const { documentId } = req.params;

      const document = await EmployeeDocument.findById(documentId);

      if (!document) {
        return res.status(404).json({
          message: "Document not found",
        });
      }

      if (!document.storagePath) {
        return res.status(404).json({
          message: "Document storage path not found",
        });
      }

      const { data, error } = await supabase.storage
        .from("employees_documents")
        .download(document.storagePath);

      if (error || !data) {
        return res.status(404).json({
          message: "Document file not found",
        });
      }

      const buffer = Buffer.from(await data.arrayBuffer());

      res.setHeader(
        "Content-Type",
        document.mimeType || "application/octet-stream"
      );

      res.setHeader(
        "Content-Disposition",
        `inline; filename="${document.originalName}"`
      );

      res.setHeader("Cache-Control", "public, max-age=3600");

      return res.status(200).send(buffer);
    } catch (error) {
      console.error("FAILED TO DOWNLOAD DOCUMENT:", error);

      return res.status(500).json({
        message: "FAILED TO DOWNLOAD DOCUMENT",
      });
    }
  }
);

export default router;
