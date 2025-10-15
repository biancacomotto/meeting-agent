import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { configDotenv } from "dotenv";
import getStats from "./tools/get_stats.mjs";
import login from "./tools/login.mjs";
import register from "./tools/register.mjs";
import sendEmail from "./tools/send_email.mjs";
import { MemorySaver } from "@langchain/langgraph";
import readline from "readline";

configDotenv({ quiet: true });

const checkpointer = new MemorySaver();

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.5-flash",
});

const agent = createReactAgent({
  llm: model,
  tools: [getStats, login, register, sendEmail],
  checkpointer,
});

const instance = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  while (true) {
    await new Promise((resolve) => {
      instance.question("> ", (response) => {
        if (
          response.toLowerCase() === "exit" ||
          response.toLowerCase() === "quit"
        ) {
          instance.close();
          exit(1);
        }

        agent
          .invoke(
            { messages: [{ role: "user", content: response }] },
            { configurable: { thread_id: "thread_id" } }
          )
          .then((result) => {
            const last = result.messages[result.messages.length - 1];
            console.log(last.content);
            resolve();
          })
          .catch((error) => {
            console.log(error);
            resolve();
          });
      });
    });
  }
}

main();
