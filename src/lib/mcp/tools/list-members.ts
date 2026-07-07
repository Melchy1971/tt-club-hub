import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_members",
  title: "List members",
  description:
    "List club members with basic contact info and TTR/QTTR rating. Optional case-insensitive name search.",
  inputSchema: {
    search: z
      .string()
      .trim()
      .optional()
      .describe("Name substring (matches first or last name, case-insensitive)."),
    include_inactive: z.boolean().optional().describe("Include inactive members (default false)."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, include_inactive, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    let query = supabaseForUser(ctx)
      .from("members")
      .select(
        "id, first_name, last_name, email, age_group, gender, ttr_rating, qttr_rating, is_active",
      )
      .order("last_name")
      .limit(limit ?? 50);
    if (!include_inactive) query = query.eq("is_active", true);
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    const { data, error } = await query;
    return error ? errorResult(error.message) : jsonResult(data);
  },
});