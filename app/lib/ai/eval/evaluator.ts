import { orchestrateWithSubAgents } from "@/app/lib/ai/orchestrator/router";
import { TaskName } from "@/app/lib/ai/orchestrator/types";
import { EvalCase, EvalCaseResult, EvalReport } from "./types";

const looksLikeJson = (value: string): boolean => {
  const trimmed = value.trim();
  return (
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    trimmed.startsWith("```") ||
    /^[{[]/.test(trimmed)
  );
};

const includesAny = (value: string, needles: string[]) =>
  needles.some((needle) => value.toLowerCase().includes(needle.toLowerCase()));

const includesAll = (value: string, needles: string[]) =>
  needles.every((needle) => value.toLowerCase().includes(needle.toLowerCase()));

const askedQuestion = (value: string) => value.includes("?");

const scoreCriteria = (criteria: Record<string, boolean>) => {
  const entries = Object.values(criteria);
  if (!entries.length) return 1;
  const hits = entries.filter(Boolean).length;
  return hits / entries.length;
};

const resolveExpectedAgent = (
  expected: TaskName | undefined,
  usedAgents: TaskName[]
) => {
  if (!expected) return true;
  return usedAgents.includes(expected);
};

export const evaluateCase = async (item: EvalCase): Promise<EvalCaseResult> => {
  let lastContent = "";
  let lastAgents: TaskName[] = [];

  for (const message of item.turns) {
    const { content, usedAgents } = await orchestrateWithSubAgents(
      item.conversationId,
      message
    );
    lastContent = content;
    lastAgents = usedAgents;
  }

  const criteria: Record<string, boolean> = {};
  if (item.expectedAgent) {
    criteria.expectedAgent = resolveExpectedAgent(item.expectedAgent, lastAgents);
  }
  if (item.mustInclude && item.mustInclude.length > 0) {
    criteria.mustInclude = includesAll(lastContent, item.mustInclude);
  }
  if (item.mustNotInclude && item.mustNotInclude.length > 0) {
    criteria.mustNotInclude = !includesAny(lastContent, item.mustNotInclude);
  }
  if (item.mustAskQuestion) {
    criteria.mustAskQuestion = askedQuestion(lastContent);
  }
  if (item.mustNotIncludeJson) {
    criteria.mustNotIncludeJson = !looksLikeJson(lastContent);
  }

  const score = scoreCriteria(criteria);
  const passed = score === 1;

  return {
    id: item.id,
    description: item.description,
    passed,
    score,
    criteria,
    usedAgents: lastAgents,
    response: lastContent,
  };
};

export const runEvaluation = async (cases: EvalCase[]): Promise<EvalReport> => {
  const results: EvalCaseResult[] = [];

  for (const item of cases) {
    results.push(await evaluateCase(item));
  }

  const passed = results.filter((result) => result.passed).length;
  const averageScore =
    results.reduce((sum, result) => sum + result.score, 0) /
    Math.max(results.length, 1);

  return {
    summary: {
      total: results.length,
      passed,
      averageScore: Number(averageScore.toFixed(2)),
    },
    results,
  };
};
