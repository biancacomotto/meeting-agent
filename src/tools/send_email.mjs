import { tool } from "@langchain/core/tools";
import { configDotenv } from "dotenv";
import z from "zod";

configDotenv({ quiet: true });

const sendEmail = tool(
  async ({ token, body, subject, to }) => {
    const response = await fetch(`${process.env.API}/emails`, {
      method: "POST",
      body: JSON.stringify({
        body,
        subject,
        to,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      return response.statusText;
    }
    return response.json();
  },
  {
    name: "send_email",
    description: "Send an email with the email service.",
    schema: z.object({
      token: z.string().describe("The user's token."),
      body: z.string().describe("The email body."),
      subject: z.string().optional().describe("The email subject (optional)."),
      to: z.array(z.string()).describe("List of recipient email addresses."),
    }),
  }
);

export default sendEmail;
