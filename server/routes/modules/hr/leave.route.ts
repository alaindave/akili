import express from "express";
import authorize from "../../../middlewares/authorize.js";

// Explicit retirement response: legacy clients must not keep writing the source
// collection after migration. Queue compatibility is handled in Stage 3.
const router = express.Router();
router.use(authorize);
router.use((_req, res) => {
  res.status(410).json({ code: "TIME_OFF_API_REQUIRED", message: "Utilisez l’API /time-off avec un motif configuré." });
});
export default router;
