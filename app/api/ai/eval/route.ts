import { NextRequest, NextResponse } from "next/server";
import { evalCases } from "@/app/lib/ai/eval/cases";
import { runEvaluation } from "@/app/lib/ai/eval/evaluator";
import { EvalCase } from "@/app/lib/ai/eval/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}));
    const customCases = Array.isArray(payload?.cases)
      ? (payload.cases as EvalCase[])
      : null;
    const casesToRun = customCases && customCases.length > 0 ? customCases : evalCases;
    const report = await runEvaluation(casesToRun);

    return NextResponse.json({ ok: true, report });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "eval failed" },
      { status: 400 }
    );
  }
}
