import { ipcMain } from "../companyIpc.js";
import { app } from "electron";
import { NetworkService } from "../../services/shared/sync/network.service.js";
import axios from "axios";
import {
  establishCompanySession,
  endCompanySession,
  initializeAuthenticatedCompany,
  loginCredentialsSchema,
} from "../../services/shared/companySession.service.js";
import { SignUpCredentials } from "../../../common/types/shared/Credentials.js";

const API_URL = app.isPackaged
  ? "https://leather-works.onrender.com"
  : process.env.VITE_API_URL;

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

    const { email, password, companyId } =
      loginCredentialsSchema.parse(credentials);

    try {
      const res = await axios.post(`${API_URL}/auth`, {
        email,
        password,
        ...(companyId ? { companyId } : {}),
      });

      // ---------------------------------------------------------
      // SAVE AUTH TOKEN
      // ---------------------------------------------------------

      const token = res.headers["x-auth-token"];

      if (!token) {
        throw new Error("LOGIN SUCCEEDED BUT NO AUTH TOKEN WAS RETURNED");
      }

      console.log("ONLINE LOGIN:", res.data);

      // ---------------------------------------------------------
      // INITIALIZE / VERIFY COMPANY
      // ---------------------------------------------------------

      const company = res.data?.company;

      await initializeAuthenticatedCompany(company, companyId);
      await establishCompanySession(
        { ...res.data.admin, companyId: company.companyId },
        token
      );

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
      await endCompanySession();

      return true;
    } catch (error) {
      console.error("ERROR OCCURED DURING LOGOUT:", error);
      throw error;
    }
  });

  // =========================================================
  // SIGNUP
  // =========================================================

  ipcMain.handle("auth:signup", async (_, credentials: SignUpCredentials) => {
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

      console.log("USER SIGN UP:", res.data);

      // ---------------------------------------------------------
      // INITIALIZE / VERIFY COMPANY
      // ---------------------------------------------------------

      const company = res.data?.company;

      await initializeAuthenticatedCompany(company);
      await establishCompanySession(
        { ...res.data.admin, companyId: company.companyId },
        token
      );

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
