import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_news",
  title: "List news",
  description: "List the most recent published club news items.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max rows (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const { data, error } = await supabaseForUser(ctx)
      .from("news")
      .select("id, title, content, published_at, is_published")
      .eq("is_published", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit ?? 10);
    return error ? errorResult(error.message) : jsonResult(data);
  },
});