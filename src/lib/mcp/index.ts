import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTeamsTool from "./tools/list-teams";
import listMembersTool from "./tools/list-members";
import listUpcomingMatchesTool from "./tools/list-upcoming-matches";
import listNewsTool from "./tools/list-news";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "tt-manager-pro-mcp",
  title: "TT-Manager Pro",
  version: "0.1.0",
  instructions:
    "Read-only tools for the TT-Manager Pro table tennis club app. Use these to look up teams, members, upcoming matches, and published news for the signed-in user's club.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listTeamsTool, listMembersTool, listUpcomingMatchesTool, listNewsTool],
});