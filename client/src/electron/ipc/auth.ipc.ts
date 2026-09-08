import { ipcMain, app } from "electron";
import { NetworkService } from "../services/sync/network.service.js";
import axios from "axios";
import { clearToken, saveToken } from "../auth.js";

import {
  getCompany,
  upsertCompanyId,
} from "../database/repositories/companies.repository.js";

const API_URL = app.isPackaged
  ? "https://leather-works.onrender.com"
  : process.env.VITE_API_URL;

// =========================================================
// INITIALIZE / VERIFY LOCAL COMPANY
// =========================================================

async function initializeLocalCompany(company: any): Promise<void> {
  if (!company) {
    throw new Error(
      "AUTHENTICATION SUCCEEDED BUT COMPANY DATA WAS NOT RETURNED BY SERVER"
    );
  }

  if (!company.companyId) {
    throw new Error("AUTHENTICATION SUCCEEDED BUT COMPANY HAS NO COMPANY ID");
  }

  const localCompany = await getCompany(company.companyId);

  // ---------------------------------------------------------
  // FIRST LOGIN / FIRST SIGNUP ON THIS INSTALLATION
  // ---------------------------------------------------------
  if (!localCompany) {
    console.log(
      `NO LOCAL COMPANY FOUND WITH GIVEN COMPANY ID. INITIALIZING COMPANY: ${company.companyId}`
    );

    await upsertCompanyId(company);

    console.log(`LOCAL COMPANY INITIALIZED SUCCESSFULLY: ${company.companyId}`);

    return;
  }

  // ---------------------------------------------------------
  // EXISTING INSTALLATION
  // ---------------------------------------------------------

  console.log(`LOCAL COMPANY FOUND: ${localCompany.companyId}`);

  // if (localCompany.companyId !== company.companyId) {
  //   throw new Error(
  //     `THIS INSTALLATION IS ALREADY ASSOCIATED WITH COMPANY ${localCompany.companyId}`
  //   );
  // }

  console.log("COMPANY ID VERIFIED.");
}

export function registerAuthIPC() {
  console.log("REGISTERING AUTH IPC");
  console.log("AUTH API URL:", API_URL);

  // =========================================================
  // LOGIN
  // =========================================================

  ipcMain.handle("auth:login", async (_, credentials) => {
    console.log("LOGIN IPC RECEIVED", credentials);

    if (!credentials) {
      throw new Error("MISSING CREDENTIALS");
    }

    const online = await NetworkService.canReachBackend();

    if (!online) {
      return {
        success: false,
        message: "Backend unreachable",
      };
    }

    const { email, password } = credentials;

    try {
      const res = await axios.post(`${API_URL}/auth`, {
        email,
        password,
      });

      // ---------------------------------------------------------
      // SAVE AUTH TOKEN
      // ---------------------------------------------------------

      const token = res.headers["x-auth-token"];

      if (!token) {
        throw new Error("LOGIN SUCCEEDED BUT NO AUTH TOKEN WAS RETURNED");
      }

      await saveToken(token);

      console.log("ONLINE LOGIN:", res.data);

      // ---------------------------------------------------------
      // INITIALIZE / VERIFY COMPANY
      // ---------------------------------------------------------

      const company = res.data?.company;

      await initializeLocalCompany(company);

      return res.data;
    } catch (error) {
      console.error("ERROR OCCURED DURING ONLINE LOGIN:", error);
      throw error;
    }
  });

  // =========================================================
  // LOGOUT
  // =========================================================

  ipcMain.handle("auth:logout", async () => {
    console.log("LOGOUT IPC RECEIVED");

    try {
      await clearToken();

      return true;
    } catch (error) {
      console.error("ERROR OCCURED DURING LOGOUT:", error);
      throw error;
    }
  });

  // =========================================================
  // SIGNUP
  // =========================================================

  ipcMain.handle("auth:signup", async (_, credentials) => {
    console.log("SIGN UP IPC RECEIVED", credentials);

    if (!credentials) {
      throw new Error("MISSING CREDENTIALS");
    }

    const online = await NetworkService.canReachBackend();

    if (!online) {
      return {
        success: false,
        message: "Backend unreachable",
      };
    }

    const { firstName, lastName, email, password, signUpCode } = credentials;

    if (!signUpCode) {
      throw new Error("MISSING SIGN UP CODE");
    }

    try {
      const res = await axios.post(
        `${API_URL}/adminUsers`,
        {
          firstName,
          lastName,
          email,
          password,
        },
        {
          headers: {
            "x-signup-code": signUpCode.trim(),
          },
        }
      );

      // ---------------------------------------------------------
      // SAVE AUTH TOKEN
      // ---------------------------------------------------------

      const token = res.headers["x-auth-token"];

      if (!token) {
        throw new Error("SIGNUP SUCCEEDED BUT NO AUTH TOKEN WAS RETURNED");
      }

      await saveToken(token);

      console.log("USER SIGN UP:", res.data);

      // ---------------------------------------------------------
      // INITIALIZE / VERIFY COMPANY
      // ---------------------------------------------------------

      const company = res.data?.company;

      await initializeLocalCompany(company);

      console.log(
        `SIGNUP COMPANY INITIALIZATION COMPLETE: ${company.companyId}`
      );

      return res.data;
    } catch (error) {
      console.error("ERROR OCCURED DURING SIGNUP:", error);
      throw error;
    }
  });
}
