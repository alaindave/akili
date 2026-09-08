import "dotenv/config";

import readline from "readline";
import mongoose from "mongoose";
import { createCompany } from "../services/companies.service.js";
import { connectDatabase } from "../utils/databaseConnection.js";

function askQuestion(
  rl: readline.Interface,
  question: string
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("");
    console.log("=================================");
    console.log("       AKILI SETUP");
    console.log("        New Company");
    console.log("=================================");
    console.log("");

    const companyName = await askQuestion(rl, "Company name: ");

    const companyLegalName = await askQuestion(rl, "Company legal name: ");

    const address = await askQuestion(rl, "Company address: ");

    const city = await askQuestion(rl, "City: ");

    const country = await askQuestion(rl, "Country: ");

    const phone = await askQuestion(rl, "Phone: ");

    const email = await askQuestion(rl, "Email: ");

    const adminFirstName = await askQuestion(rl, "Admin first name: ");

    const adminLastName = await askQuestion(rl, "Admin last name: ");

    const adminEmail = await askQuestion(rl, "Admin email: ");

    const adminPassword = await askQuestion(rl, "Admin password: ");

    if (
      !companyName ||
      !companyLegalName ||
      !address ||
      !city ||
      !country ||
      !phone ||
      !email ||
      !adminFirstName ||
      !adminLastName ||
      !adminEmail ||
      !adminPassword
    ) {
      throw new Error("All fields are required.");
    }

    console.log("");
    await connectDatabase();

    console.log("CREATING COMPANY...");

    const result = await createCompany({
      companyName,
      companyLegalName,
      address,
      city,
      country,
      phone,
      email,
      adminFirstName,
      adminLastName,
      adminEmail,
      adminPassword,
    });

    console.log("");
    console.log("=================================");
    console.log("      COMPANY CREATED!");
    console.log("=================================");
    console.log("");

    console.log(`Company: ${result.company.name}`);

    console.log(`Company ID: ${result.company._id}`);

    console.log(`Admin: ${result.adminUser.email}`);

    console.log(`Admin ID: ${result.adminUser._id}`);

    console.log(`Roles created: ${result.roles.length}`);

    console.log("");
  } catch (error) {
    console.error("");
    console.error("FAILED TO CREATE COMPANY:");
    console.error(error);
    console.error("");
    process.exitCode = 1;
  } finally {
    rl.close();

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

main();
