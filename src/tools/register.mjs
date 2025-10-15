import { tool } from "@langchain/core/tools";
import { configDotenv } from "dotenv";
import z from "zod";

configDotenv({ quiet: true });

const register = tool(
  async ({ username, password }) => {
    const response = await fetch(`${process.env.API}/auth/register`, {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      return response.statusText;
    }
    return response.json();
  },
  {
    name: "register",
    description: "Register to the email service.",
    schema: z.object({
      username: z.string().describe("The username."),
      password: z.string().describe("The password."),
    }),
  }
);

export default register;
