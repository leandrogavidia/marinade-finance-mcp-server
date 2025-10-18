import type z from "zod";

export interface MarinadeFinanceTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  callback: (args: any) => Promise<{ content: Array<{ type: string; text: string }> }>;
}