import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Newspaper, FileText, ListChecks, Trophy, Search, Download, Filter } from 'lucide-react';
import type { Member } from '@/types';

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

interface CommList {
  id: string;
  name: string;
  description: string | null;
  list_type: string;
  created_at: string;
}

// ─── Tab Components ───────────────────────────────────────────────────────────

function NewsTab() {
  const [showPublishedOnly, setShowPublishedOnly] = useState(true);

  const { data: news, isLoading } = useQuery({
    queryKey: ['news', showPublishedOnly],
    queryFn: async () => {
      let q = supabase
        .from('news')
        .select('*')
        .order('created_at', { ascending: false });
      if (showPublishedOnly) q = q.eq('is_published', true);
      const { data, error } = await q;
      if (error) throw error;
      return data as NewsItem[];
    },
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
          {showPublishedOnly ? 'Nur veröffentlicht' : 'Alle anzeigen'}
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
    queryKey: ['documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DocumentItem[];
    },
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

function ListsTab() {
  const { data: lists, isLoading } = useQuery({
    queryKey: ['communication-lists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_lists')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as CommList[];
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  const TYPE_LABELS: Record<string, string> = {
    email: 'E-Mail',
    whatsapp: 'WhatsApp',
    telefon: 'Telefon',
  };

  return !lists?.length ? (
    <EmptyState
      icon={ListChecks}
      title="Keine Listen"
      description="Es wurden noch keine Kommunikationslisten erstellt."
    />
  ) : (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Beschreibung</TableHead>
            <TableHead>Erstellt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lists.map((list) => (
            <TableRow key={list.id}>
              <TableCell className="font-medium">{list.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{TYPE_LABELS[list.list_type] ?? list.list_type}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{list.description ?? '–'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatGermanDate(list.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RatingTab() {
  const [search, setSearch] = useState('');

  const { data: members, isLoading } = useQuery({
    queryKey: ['members-ratings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, first_name, last_name, ttr_rating, qttr_rating, is_active')
        .eq('is_active', true)
        .order('qttr_rating', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as Pick<Member, 'id' | 'first_name' | 'last_name' | 'ttr_rating' | 'qttr_rating' | 'is_active'>[];
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  const filtered = (members ?? []).filter((m) =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportPDF = () => {
    // Build a simple printable HTML and open print dialog
    const rows = filtered.map((m, i) =>
      `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:center">${i + 1}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #ddd">${m.first_name} ${m.last_name}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right">${m.qttr_rating ?? '–'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right">${m.ttr_rating ?? '–'}</td>
      </tr>`
    ).join('');

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

const VALID_TABS = ['news', 'dokumente', 'listen', 'qttr'] as const;
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
        <p className="page-description">News, Dokumente, Listen und Ranglisten verwalten</p>
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
          <TabsTrigger value="listen">
            <ListChecks className="mr-1.5 h-3.5 w-3.5" />
            Listen
          </TabsTrigger>
          <TabsTrigger value="qttr">
            <Trophy className="mr-1.5 h-3.5 w-3.5" />
            QTTR/TTR
          </TabsTrigger>
        </TabsList>

        <TabsContent value="news"><NewsTab /></TabsContent>
        <TabsContent value="dokumente"><DocumentsTab /></TabsContent>
        <TabsContent value="listen"><ListsTab /></TabsContent>
        <TabsContent value="qttr"><RatingTab /></TabsContent>
      </Tabs>
    </div>
  );
}
