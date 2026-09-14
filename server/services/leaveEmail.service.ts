import { Resend } from "resend";

console.log("RESEND_API_KEY exists:", !!process.env.RESEND_API_KEY);

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendLeaveRequestEmailParams {
  employeeName: string;
  startDate: Date | string;
  endDate: Date | string;
  subject: string;
  notes: string;
}

// =========================
// SEND LEAVE REQUEST EMAIL
// =========================
const sendLeaveRequestEmail = async ({
  employeeName,
  startDate,
  endDate,
  subject,
  notes,
}: SendLeaveRequestEmailParams) => {
  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error("Missing RESEND_API_KEY in environment variables");
    }

    const emailFrom = process.env.EMAIL_FROM;
    const managerEmail = process.env.MANAGER_EMAIL;

    if (!emailFrom || !managerEmail) {
      throw new Error("Missing email configuration variables");
    }

    const result = await resend.emails.send({
      from: emailFrom,
      to: managerEmail,

      subject: "Nouvelle demande de congé",

      html: `
        <div style="font-family: Arial; padding: 20px;">
          <h2>Nouvelle demande de congé</h2>

          <p>
            <strong>Employé:</strong>
            ${employeeName}
          </p>

          <p>
            <strong>Date de début:</strong>
            ${new Date(startDate).toLocaleDateString("fr-FR")}
          </p>

          <p>
            <strong>Date de fin:</strong>
            ${new Date(endDate).toLocaleDateString("fr-FR")}
          </p>

          <p>
            <strong>Motif:</strong>
            ${subject}
          </p>

          <p>
            <strong>Notes:</strong>
            ${notes}
          </p>

          <p>
            Veuillez vous connecter dans l'application Leather Works
            pour approuver ou refuser la demande.
          </p>
        </div>
      `,
    });

    console.log("Email sent via Resend:", result);

    return result;
  } catch (error) {
    console.error("RESEND EMAIL ERROR:");
    console.error(error);

    throw error;
  }
};

export default sendLeaveRequestEmail;
