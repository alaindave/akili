import { app } from "electron";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

let installationId: string | null = null;

export function getInstallationId(): string {
  if (installationId) {
    return installationId;
  }

  const configPath = path.join(
    app.getPath("appData"),
    "Akili",
    "installation.json"
  );

  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

      if (typeof config.installationId === "string") {
        installationId = config.installationId;

        return config.installationId;
      }
    }
  } catch (error) {
    console.error("FAILED TO READ INSTALLATION ID:", error);
  }

  const newInstallationId = randomUUID();

  try {
    fs.mkdirSync(path.dirname(configPath), {
      recursive: true,
    });

    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          installationId: newInstallationId,
        },
        null,
        2
      ),
      "utf-8"
    );
  } catch (error) {
    console.error("FAILED TO SAVE INSTALLATION ID:", error);
    throw error;
  }

  installationId = newInstallationId;

  return newInstallationId;
}
