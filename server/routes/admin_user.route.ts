import express, { Request, Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import _ from "lodash";

import { validateAdminUser } from "../models/adminUser.model.js";
import {
  createAdminUser,
  updateAdminUser,
  getAdminUserByID,
  getAllAdmins,
  getAdminUserByEmail,
} from "../db.js";

import Company from "../models/company.model.js";

const router = express.Router();

interface AdminParams {
  _id: string;
}

// Create new admin user
router.post("/", async (req: Request, res: Response) => {
  try {
    const signUpCode = req.header("x-signup-code")?.trim();

    if (!signUpCode) {
      return res.status(400).send("Signup code is required.");
    }

    console.log("SIGNUP CODE:", signUpCode);
    console.log("SIGN UP DATA", req.body);

    /*
     * Find the company associated with the signup code.
     */
    const company = await Company.findOne({
      signUpCode,
      isDeleted: { $ne: 1 },
    });

    if (!company) {
      console.log("INVALID SIGNUP CODE:", signUpCode);

      return res.status(400).send("Invalid signup code.");
    }

    console.log("COMPANY FOUND:", {
      companyId: company.companyId,
      name: company.name,
      legalName: company.legalName,
    });

    /*
     * Validate admin user data.
     */
    const { error } = validateAdminUser(req.body);

    if (error) {
      console.log("VALIDATION ERROR:", error.details[0].message);

      return res.status(400).send(error.details[0].message);
    }

    /*
     * Check whether this email is already registered.
     */
    let adminUser = await getAdminUserByEmail(req.body.email);

    if (adminUser) {
      console.log("USER ALREADY REGISTERED:", adminUser);

      return res.status(400).send("Admin user already registered");
    }

    /*
     * Hash password.
     */
    const salt = await bcrypt.genSalt(10);

    const passwordHash = await bcrypt.hash(req.body.password, salt);

    /*
     * Create the admin user with the companyId
     * determined from the signup code.
     */
    adminUser = await createAdminUser({
      companyId: company.companyId,
      ..._.pick(req.body, ["firstName", "lastName", "email"]),
      passwordHash,
    });

    console.log("REGISTERED ADMIN USER:", adminUser);

    /*
     * Generate authentication token.
     */
    const token = adminUser.generateAuthToken();

    /*
     * Return authenticated admin + complete company data.
     */
    return res
      .set("Access-Control-Expose-Headers", "X-auth-token")
      .header("x-auth-token", token)
      .status(201)
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
          companyId: company.companyId,
          name: company.name,
          legalName: company.legalName,
          logoPath: company.logoPath,
          address: company.address,
          city: company.city,
          country: company.country,
          phone: company.phone,
          email: company.email,
          website: company.website,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
          serverVersion: company.serverVersion,
        },
      });
  } catch (error) {
    console.error("ERROR CREATING ADMIN USER:", error);

    return res.status(500).send("Internal server error.");
  }
});

// Fetch all admins
router.get("/", async (req: Request, res: Response) => {
  try {
    const admins = await getAllAdmins();

    if (!admins) {
      return res.status(404).send("No admins found.");
    }

    console.log("FETCHED ADMIN USERS:", admins);

    return res.status(200).send(admins);
  } catch (error) {
    console.error("AN ERROR OCCURED WHILE FETCHING ADMIN USERS:", error);

    return res.status(500).send(error);
  }
});

// Fetch admin user info
router.get("/:_id", async (req: Request<AdminParams>, res: Response) => {
  console.log("ADMIN ID:", req.params._id);

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params._id)) {
      return res.status(400).send("INVALID ADMIN ID");
    }

    const admin = await getAdminUserByID(req.params._id);

    if (!admin) {
      console.log("NO ADMIN FOUND WITH THE GIVEN ID.");

      return res.status(404).send("No admin found with the given ID.");
    }

    console.log("FETCHED ADMIN:", admin);

    return res.status(200).send({
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      notes: admin.notes,
    });
  } catch (error) {
    console.error("AN ERROR OCCURED WHILE FETCHING ADMIN:", error);

    return res.status(500).send(error);
  }
});

// Edit admin user
router.put("/:_id", async (req: Request<AdminParams>, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params._id)) {
      return res.status(400).send("Invalid admin ID");
    }

    const admin = await getAdminUserByID(req.params._id);

    if (!admin) {
      return res.status(404).send("No admin found with the given ID.");
    }

    console.log("ADMIN TO UPDATE:", admin);
    console.log("INFO TO MODIFY:", req.body);

    const updatedAdmin = await updateAdminUser(req.params._id, req.body);

    console.log("UPDATED ADMIN:", updatedAdmin);

    return res.status(200).send(updatedAdmin);
  } catch (error) {
    console.error("AN ERROR OCCURED WHILE UPDATING ADMIN INFO:", error);

    return res.status(500).send(error);
  }
});

export default router;
