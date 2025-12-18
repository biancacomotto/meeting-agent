import { TaskName } from "@/app/lib/ai/orchestrator/types";

export type EvalCase = {
  id: string;
  description: string;
  conversationId: string;
  turns: string[];
  expectedAgent?: TaskName;
  mustInclude?: string[];
  mustNotInclude?: string[];
  mustAskQuestion?: boolean;
  mustNotIncludeJson?: boolean;
};

export type EvalCaseResult = {
  id: string;
  description: string;
  passed: boolean;
  score: number;
  criteria: Record<string, boolean>;
  usedAgents: TaskName[];
  response: string;
};

export type EvalSummary = {
  total: number;
  passed: number;
  averageScore: number;
};

export type EvalReport = {
  summary: EvalSummary;
  results: EvalCaseResult[];
};
