import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Newspaper, FileText, Trophy, Search, Download, Filter } from 'lucide-react';
import type { Member } from '@/types';
import { communicationKeys, communicationCacheConfig } from '@/lib/queryKeys';
import { newsService } from '@/services/newsService';
import { documentService } from '@/services/documentService';
import { communicationExportService } from '@/services/communicationExportService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatGermanDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsItem {
  id: string;
  title: string;
  content: string;
  is_published: boolean;
  published_at: string | null;
  author_id: string;
  created_at: string;
}

interface DocumentItem {
  id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  category: string;
  uploaded_by: string;
  created_at: string;
}

// ─── Tab Components ───────────────────────────────────────────────────────────

function NewsTab() {
  const [showPublishedOnly, setShowPublishedOnly] = useState(true);

  const audience = showPublishedOnly ? 'public' : 'all';
  const { data: news, isLoading } = useQuery({
    queryKey: communicationKeys.news.list({ audience, status: showPublishedOnly ? 'published' : 'all' }),
    queryFn: async () => {
      const result = await newsService.list({ audience, status: showPublishedOnly ? 'published' : 'all' });
      if (!result.success) throw new Error(result.error.message);
      return result.data as NewsItem[];
    },
    staleTime: showPublishedOnly ? communicationCacheConfig.public.staleTime : communicationCacheConfig.internal.staleTime,
    gcTime: showPublishedOnly ? communicationCacheConfig.public.gcTime : communicationCacheConfig.internal.gcTime,
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={showPublishedOnly ? 'default' : 'outline'}
          onClick={() => setShowPublishedOnly(!showPublishedOnly)}
        >
          <Filter className="mr-1.5 h-3.5 w-3.5" />
          {showPublishedOnly ? 'Auch Entwürfe anzeigen' : 'Nur veröffentlichte anzeigen'}
        </Button>
      </div>

      {!news?.length ? (
        <EmptyState
          icon={Newspaper}
          title="Keine Neuigkeiten"
          description="Es wurden noch keine News veröffentlicht."
        />
      ) : (
        <div className="space-y-4">
          {news.map((item) => (
            <div key={item.id} className="rounded-lg border bg-card p-5 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-semibold text-lg">{item.title}</h3>
                <div className="flex items-center gap-2 shrink-0">
                  {!item.is_published && (
                    <Badge variant="outline" className="text-xs">Entwurf</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {item.published_at ? formatGermanDate(item.published_at) : formatGermanDate(item.created_at)}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {item.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentsTab() {
  const [search, setSearch] = useState('');

  const { data: docs, isLoading } = useQuery({
    queryKey: communicationKeys.documents.list({ audience: 'public' }),
    queryFn: async () => {
      const result = await documentService.list({ audience: 'public' });
      if (!result.success) throw new Error(result.error.message);
      return result.data.map((doc) => ({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        file_url: doc.fileUrl,
        category: doc.category,
        uploaded_by: doc.uploadedBy,
        created_at: doc.createdAt,
      })) as DocumentItem[];
    },
    staleTime: communicationCacheConfig.public.staleTime,
    gcTime: communicationCacheConfig.public.gcTime,
  });

  if (isLoading) return <LoadingSkeleton />;

  const filtered = (docs ?? []).filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    (d.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const CATEGORY_LABELS: Record<string, string> = {
    allgemein: 'Allgemein',
    protokoll: 'Protokoll',
    satzung: 'Satzung',
    formular: 'Formular',
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Dokument suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {!filtered.length ? (
        <EmptyState
          icon={FileText}
          title="Keine Dokumente"
          description={search ? 'Keine Dokumente zu diesem Suchbegriff gefunden.' : 'Es wurden noch keine Dokumente hochgeladen.'}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Hochgeladen</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{CATEGORY_LABELS[doc.category] ?? doc.category}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                    {doc.description ?? '–'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatGermanDate(doc.created_at)}
                  </TableCell>
                  <TableCell>
                    {doc.file_url && (
                      <Button size="icon" variant="ghost" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function RatingTab() {
  const [search, setSearch] = useState('');

  const { data: members, isLoading } = useQuery({
    queryKey: communicationKeys.exports.ratings({ audience: 'public' }),
    queryFn: async () => {
      const result = await communicationExportService.buildRatingExport({
        audience: 'public',
        generatedAt: new Date().toISOString(),
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data.rows.map((row) => ({
        id: row.memberId,
        first_name: row.firstName,
        last_name: row.lastName,
        qttr_rating: row.qttr,
        ttr_rating: row.ttr,
        is_active: true,
      })) as Pick<Member, 'id' | 'first_name' | 'last_name' | 'ttr_rating' | 'qttr_rating' | 'is_active'>[];
    },
    staleTime: communicationCacheConfig.public.staleTime,
    gcTime: communicationCacheConfig.public.gcTime,
  });

  if (isLoading) return <LoadingSkeleton />;

  const filtered = (members ?? []).filter((m) =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportPDF = async () => {
    const exportResult = await communicationExportService.buildRatingExport({
      audience: 'public',
      generatedAt: new Date().toISOString(),
    });

    if (!exportResult.success) throw new Error(exportResult.error.message);

    const byId = new Map(filtered.map((m) => [m.id, m]));
    const rows = exportResult.data.rows
      .filter((row) => byId.has(row.memberId))
      .map((row) => `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:center">${row.rank}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #ddd">${row.fullName}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right">${row.qttr ?? '–'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right">${row.ttr ?? '–'}</td>
      </tr>`)
      .join('');

    const html = `
      <!DOCTYPE html><html><head><title>QTTR/TTR-Rangliste</title>
      <style>body{font-family:sans-serif;padding:20px}table{border-collapse:collapse;width:100%}
      th{background:#f3f3f3;padding:8px 12px;border-bottom:2px solid #ddd;text-align:left}
      h1{font-size:18px;margin-bottom:4px}p{color:#666;font-size:12px;margin-bottom:16px}</style></head>
      <body><h1>QTTR/TTR-Rangliste</h1><p>Stand: ${new Date().toLocaleDateString('de-DE')}</p>
      <table><thead><tr><th style="text-align:center">#</th><th>Name</th><th style="text-align:right">QTTR</th><th style="text-align:right">TTR</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Spieler suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExportPDF}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          PDF-Export
        </Button>
      </div>

      {!filtered.length ? (
        <EmptyState
          icon={Trophy}
          title="Keine Spieler gefunden"
          description="Es gibt keine aktiven Spieler mit TTR-Wertung."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">QTTR</TableHead>
                <TableHead className="text-right">TTR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m, i) => (
                <TableRow key={m.id}>
                  <TableCell className="text-center font-medium text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{m.first_name} {m.last_name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.qttr_rating != null ? (
                      <span className="font-semibold">{m.qttr_rating}</span>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.ttr_rating != null ? m.ttr_rating : <span className="text-muted-foreground">–</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-md" />
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const VALID_TABS = ['news', 'dokumente', 'qttr'] as const;
type TabValue = typeof VALID_TABS[number];

export default function Communication() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as TabValue | null;
  const activeTab: TabValue = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'news';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Kommunikation</h1>
        <p className="page-description">News, Dokumente und Ranglisten</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="news">
            <Newspaper className="mr-1.5 h-3.5 w-3.5" />
            News
          </TabsTrigger>
          <TabsTrigger value="dokumente">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Dokumente
          </TabsTrigger>
          <TabsTrigger value="qttr">
            <Trophy className="mr-1.5 h-3.5 w-3.5" />
            QTTR/TTR
          </TabsTrigger>
        </TabsList>

        <TabsContent value="news"><NewsTab /></TabsContent>
        <TabsContent value="dokumente"><DocumentsTab /></TabsContent>
        <TabsContent value="qttr"><RatingTab /></TabsContent>
      </Tabs>
    </div>
  );
}
