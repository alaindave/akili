import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import Joi from "joi";
import { getAdminUserByEmail, getCompanyById } from "../db.js";

const router = express.Router();

interface LoginRequest {
  email: string;
  password: string;
}

// Authenticate user
router.post("/", async (req: Request<{}, {}, LoginRequest>, res: Response) => {
  const { error } = validate(req.body);

  if (error) {
    console.error("Validation error:", error);

    return res.status(400).send(error.details[0].message);
  }

  try {
    const adminUser = await getAdminUserByEmail(req.body.email);

    if (!adminUser) {
      return res.status(400).send("Invalid email or password.");
    }

    const validPassword = await bcrypt.compare(
      req.body.password,
      adminUser.passwordHash
    );

    if (!validPassword) {
      return res.status(400).send("Invalid email or password.");
    }

    // =========================================================
    // GET COMPANY
    // =========================================================

    if (!adminUser.companyId) {
      return res.status(403).send("User is not assigned to a company.");
    }

    const company = await getCompanyById(adminUser.companyId);

    if (!company) {
      return res.status(404).send("Company not found.");
    }

    // =========================================================
    // GENERATE AUTH TOKEN
    // =========================================================

    const token = adminUser.generateAuthToken();

    // =========================================================
    // RETURN ADMIN + COMPANY
    // =========================================================

    return res
      .set("Access-Control-Expose-Headers", "X-auth-token")
      .header("x-auth-token", token)
      .send({
        admin: {
          _id: adminUser._id,
          companyId: adminUser.companyId,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
          role: adminUser.role,
          notes: adminUser.notes,
          createdAt: adminUser.createdAt,
          updatedAt: adminUser.updatedAt,
        },

        company: {
          _id: company._id,
          companyId: company.companyId,
          name: company.name,
          legalName: company.legalName,
          address: company.address,
          city: company.city,
          country: company.country,
          phone: company.phone,
          email: company.email,
          website: company.website,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
          serverVersion: company.serverVersion,
          isDeleted: company.isDeleted,
        },
      });
  } catch (error) {
    console.error("AUTHENTICATION ERROR:", error);

    return res.status(500).send("Server error");
  }
});

function validate(body: LoginRequest) {
  const schema = Joi.object({
    email: Joi.string().min(5).max(255).required().email(),
    password: Joi.string().min(6).max(255).required(),
  });

  return schema.validate(body);
}

export default router;
