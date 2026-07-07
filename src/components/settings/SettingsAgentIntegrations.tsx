import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, RefreshCw, Copy, ExternalLink, Loader2, Wrench, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import manifest from '../../../.lovable/mcp/manifest.json';

type MCPTool = {
  name: string;
  title?: string;
  description?: string;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
};

type MCPManifest = {
  path: string;
  auth?: { type?: string; issuer?: string; accepted_audiences?: string[] };
  mcp: { server: { name: string; title?: string; version: string }; tools: MCPTool[] };
};

const typedManifest = manifest as unknown as MCPManifest;

function buildMcpUrl(): string {
  const base = import.meta.env.VITE_SUPABASE_URL ?? '';
  return `${base}${typedManifest.path}`;
}

async function pingMcp(url: string): Promise<{ ok: boolean; status: number; wantsAuth: boolean; message: string; latencyMs: number }> {
  const started = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'tt-manager-status-check', version: '1.0.0' },
      },
    }),
  });
  const latencyMs = Math.round(performance.now() - started);
  // The endpoint responds 401 for unauthenticated requests — that proves it is up and OAuth-protected.
  const wantsAuth = res.status === 401 || res.headers.has('www-authenticate');
  const ok = res.ok || wantsAuth;
  const message = wantsAuth
    ? 'Erreichbar & OAuth-geschützt (401 wie erwartet)'
    : res.ok
      ? 'Erreichbar'
      : `Unerwartete Antwort: ${res.status}`;
  return { ok, status: res.status, wantsAuth, message, latencyMs };
}

export default function SettingsAgentIntegrations() {
  const { toast } = useToast();
  const mcpUrl = useMemo(buildMcpUrl, []);
  const [refreshKey, setRefreshKey] = useState(0);

  const status = useQuery({
    queryKey: ['mcp-status', mcpUrl, refreshKey],
    queryFn: () => pingMcp(mcpUrl),
    retry: false,
    staleTime: 30_000,
  });

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: 'Kopiert', description: label });
  };

  const tools = typedManifest.mcp?.tools ?? [];
  const server = typedManifest.mcp?.server;
  const auth = typedManifest.auth;

  return (
    <div className="space-y-6">
      <div className="stat-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Verbindungsstatus</h2>
            <p className="text-sm text-muted-foreground">
              Live-Prüfung des MCP-Endpunkts – zeigt, ob externe KI-Clients (ChatGPT, Claude, …) verbinden können.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={status.isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${status.isFetching ? 'animate-spin' : ''}`} />
            Prüfen
          </Button>
        </div>

        <div className="rounded-md border p-4">
          {status.isLoading || status.isFetching ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Endpunkt wird geprüft…
            </div>
          ) : status.error ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" /> Nicht erreichbar: {(status.error as Error).message}
            </div>
          ) : status.data ? (
            <div className="flex items-center gap-2 text-sm">
              {status.data.ok ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className={status.data.ok ? 'text-foreground' : 'text-destructive'}>
                {status.data.message}
              </span>
              <span className="text-muted-foreground">· {status.data.latencyMs} ms · HTTP {status.data.status}</span>
            </div>
          ) : null}
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-[160px_1fr]">
          <dt className="text-muted-foreground">MCP-Server</dt>
          <dd className="font-medium">
            {server?.title ?? server?.name}{' '}
            <span className="text-muted-foreground font-normal">v{server?.version}</span>
          </dd>

          <dt className="text-muted-foreground">Endpoint-URL</dt>
          <dd className="flex items-center gap-2 min-w-0">
            <code className="truncate rounded bg-muted px-2 py-1 text-xs">{mcpUrl}</code>
            <Button size="icon" variant="ghost" onClick={() => copy(mcpUrl, 'MCP-URL')}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" asChild>
              <a href={mcpUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </dd>

          <dt className="text-muted-foreground">Authentifizierung</dt>
          <dd className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>OAuth 2.1 ({auth?.type ?? 'oauth'})</span>
            {auth?.accepted_audiences?.map((aud) => (
              <Badge key={aud} variant="secondary">
                {aud}
              </Badge>
            ))}
          </dd>

          {auth?.issuer && (
            <>
              <dt className="text-muted-foreground">Issuer</dt>
              <dd className="min-w-0">
                <code className="truncate rounded bg-muted px-2 py-1 text-xs">{auth.issuer}</code>
              </dd>
            </>
          )}
        </dl>
      </div>

      <div className="stat-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Wrench className="h-4 w-4" /> Verfügbare Tools
            </h2>
            <p className="text-sm text-muted-foreground">
              Diese Werkzeuge stehen verbundenen KI-Clients zur Verfügung.
            </p>
          </div>
          <Badge variant="outline">{tools.length} Tools</Badge>
        </div>

        <ul className="divide-y rounded-md border">
          {tools.map((tool) => {
            const readOnly = tool.annotations?.readOnlyHint;
            const destructive = tool.annotations?.destructiveHint;
            return (
              <li key={tool.name} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{tool.title ?? tool.name}</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {tool.name}
                    </code>
                  </div>
                  {tool.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {readOnly && <Badge variant="secondary">Nur-Lesen</Badge>}
                  {destructive && <Badge variant="destructive">Destruktiv</Badge>}
                </div>
              </li>
            );
          })}
          {tools.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">Keine Tools registriert.</li>
          )}
        </ul>
      </div>

      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Verbinden mit einem KI-Client: kopiere die Endpoint-URL oben und trage sie in ChatGPT/Claude/Codex als
        MCP-Server ein. Der Client führt anschließend den OAuth-Login gegen diese App durch.
      </div>
    </div>
  );
}