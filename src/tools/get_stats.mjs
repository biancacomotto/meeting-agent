import { tool } from "@langchain/core/tools";
import { configDotenv } from "dotenv";
import z from "zod";

configDotenv({ quiet: true });

const getStats = tool(
  async ({ token }) => {
    const response = await fetch(`${process.env.API}/stats`, {
      method: "GET",
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
    name: "get_stats",
    description: "Get stats for the email service.",
    schema: z.object({
      token: z.string().describe("The user's token."),
    }),
  }
);

export default getStats;
