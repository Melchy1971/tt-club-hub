import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_upcoming_matches",
  title: "List upcoming matches",
  description:
    "List scheduled matches from today onwards, ordered by date. Optionally filter by team_id.",
  inputSchema: {
    team_id: z.string().uuid().optional().describe("Restrict to a single team's matches."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const today = new Date().toISOString().slice(0, 10);
    let query = supabaseForUser(ctx)
      .from("schedule_matches")
      .select(
        "id, match_date, match_time, home_team, away_team, home_score, away_score, is_home, status, team_id",
      )
      .gte("match_date", today)
      .order("match_date")
      .limit(limit ?? 25);
    if (team_id) query = query.eq("team_id", team_id);
    const { data, error } = await query;
    return error ? errorResult(error.message) : jsonResult(data);
  },
});