import express, { type Request, type Response } from "express";
import authorize from "../../../middlewares/authorize.js";
import AdminUser from "../../../models/shared/adminUser.model.js";
import * as service from "../../../services/timeOff.service.js";
import { TimeOffError, identifier, validate } from "../../../validation/timeOff.validation.js";

const router = express.Router();
router.use(authorize);
router.use(async (req, res, next) => {
  try {
    if (!req.user || typeof req.user._id !== "string" || typeof req.user.companyId !== "string") {
      res.status(401).json({ code: "UNAUTHORIZED", message: "Authentification requise." }); return;
    }
    const user = await AdminUser.findOne({ _id: req.user._id, companyId: req.user.companyId, isDeleted: 0 }).lean();
    if (!user || !["ADMIN", "MANAGER", "VIEWER"].includes(user.role)) {
      res.status(403).json({ code: "FORBIDDEN", message: "Accès refusé à cette entreprise." }); return;
    }
    // Resolve current membership/role, rather than trusting stale token privileges.
    req.user = { ...req.user, role: user.role };
    next();
  } catch (error) { respondError(res, error); }
});
function respondError(res: Response, error: unknown) {
  if (error instanceof TimeOffError) return res.status(error.status).json({ code: error.code, message: error.message });
  if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
    return res.status(409).json({ code: "DUPLICATE_KEY", message: "Cet identifiant ou ce code existe déjà." });
  }
  console.error("TIME_OFF_API_ERROR", error);
  return res.status(500).json({ code: "TIME_OFF_FAILED", message: "Impossible de traiter cette opération TimeOff." });
}
const id = (req: Request) => validate<string>(identifier.required(), req.params.id);
function handle(action: (actor: service.TimeOffActor, req: Request) => Promise<unknown>, status = 200) {
  return async (req: Request, res: Response) => {
    try {
      if (!req.user) throw new TimeOffError(401, "UNAUTHORIZED", "Authentification requise.");
      const result = await action(req.user, req);
      return res.status(status).json(result);
    } catch (error) { return respondError(res, error); }
  };
}
router.get("/motifs", handle(actor => service.listMotifs(actor)));
router.post("/motifs", handle((actor, req) => service.createMotif(actor, req.body), 201));
router.get("/motifs/:id", handle((actor, req) => service.getMotif(actor, id(req))));
router.patch("/motifs/:id", handle((actor, req) => service.editMotif(actor, id(req), req.body)));
router.delete("/motifs/:id", handle((actor, req) => service.deactivateMotif(actor, id(req), req.body)));
router.get("/", handle((actor, req) => service.listRequests(actor, req.query)));
router.post("/", handle((actor, req) => service.createRequest(actor, req.body), 201));
router.get("/:id", handle((actor, req) => service.getRequest(actor, id(req))));
router.patch("/:id", handle((actor, req) => service.editRequest(actor, id(req), req.body)));
router.delete("/:id", handle((actor, req) => service.deleteRequest(actor, id(req), req.body)));
router.post("/:id/approve", handle((actor, req) => service.approveRequest(actor, id(req), req.body)));
router.post("/:id/reject", handle((actor, req) => service.rejectRequest(actor, id(req), req.body)));
router.post("/:id/cancel", handle((actor, req) => service.cancelRequest(actor, id(req), req.body)));
router.patch("/:id/notes", handle((actor, req) => service.addNotes(actor, id(req), req.body)));
router.post("/:id/review-legacy", handle((actor, req) => service.reviewLegacyRequest(actor, id(req), req.body)));
export default router;
