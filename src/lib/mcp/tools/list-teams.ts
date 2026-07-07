import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_teams",
  title: "List teams",
  description:
    "List the club's teams (name, age group, league, division, size). Only active teams unless include_inactive is true.",
  inputSchema: {
    include_inactive: z
      .boolean()
      .optional()
      .describe("Include inactive teams (default false)."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows (default 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_inactive, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    let query = supabaseForUser(ctx)
      .from("teams")
      .select("id, name, age_group, league, division, team_size, is_active, clicktt_url")
      .order("name")
      .limit(limit ?? 100);
    if (!include_inactive) query = query.eq("is_active", true);
    const { data, error } = await query;
    return error ? errorResult(error.message) : jsonResult(data);
  },
});