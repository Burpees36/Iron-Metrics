import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen, Plus, Trash2, Play, Search, Database,
  FileText, ExternalLink, ChevronDown, ChevronRight, Loader2,
} from "lucide-react";
import type { KnowledgeSource, IngestJob } from "@shared/schema";

interface KnowledgeStats {
  sources: number;
  documents: number;
  chunks: number;
  embeddedChunks: number;
}

interface DocumentSummary {
  id: string;
  title: string;
  url: string;
  status: string;
  chunkCount: number;
  channelName: string | null;
  durationSeconds: number | null;
  ingestedAt: string | null;
}

interface ChunkSummary {
  id: string;
  chunkIndex: number;
  content: string;
  taxonomy: string[];
  tokenCount: number;
  hasEmbedding: boolean;
}

interface SearchResult {
  content: string;
  chunkId: string;
  similarity: number;
  docTitle: string;
  docUrl: string;
  taxonomy: string[];
}

export default function KnowledgeAdmin() {
  const { toast } = useToast();
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceDesc, setNewSourceDesc] = useState("");
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const { data: stats } = useQuery<KnowledgeStats>({
    queryKey: ["/api/knowledge/stats"],
  });

  const { data: sources, isLoading: sourcesLoading } = useQuery<KnowledgeSource[]>({
    queryKey: ["/api/knowledge/sources"],
  });

  const { data: ingestJobs } = useQuery<IngestJob[]>({
    queryKey: ["/api/knowledge/ingest-jobs"],
    refetchInterval: 5000,
  });

  const createSource = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/knowledge/sources", {
        name: newSourceName,
        url: newSourceUrl,
        description: newSourceDesc || undefined,
        sourceType: newSourceUrl.includes("list=") ? "youtube_playlist" : "youtube_video",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/stats"] });
      setNewSourceName("");
      setNewSourceUrl("");
      setNewSourceDesc("");
      toast({ title: "Source added successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add source", description: err.message, variant: "destructive" });
    },
  });

  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/knowledge/sources/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/stats"] });
      toast({ title: "Source deleted" });
    },
  });

  const startIngest = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/knowledge/sources/${id}/ingest`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/ingest-jobs"] });
      toast({ title: "Ingestion started", description: "Processing videos in the background..." });
    },
    onError: (err: Error) => {
      toast({ title: "Ingestion failed", description: err.message, variant: "destructive" });
    },
  });

  const seedKnowledge = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/knowledge/seed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Knowledge base seeding started", description: "Processing doctrine content in the background. Refresh stats in a minute to see progress." });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/knowledge/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/knowledge/sources"] });
      }, 10000);
    },
    onError: (err: Error) => {
      toast({ title: "Seed failed", description: err.message, variant: "destructive" });
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/knowledge/search", { query: q, limit: 10 });
      return res.json() as Promise<SearchResult[]>;
    },
    onSuccess: (data) => {
      setSearchResults(data);
    },
    onError: (err: Error) => {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    searchMutation.mutate(searchQuery);
  };

  const runningJobs = ingestJobs?.filter(j => j.status === "running") || [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-knowledge-title">Knowledge Pack</h1>
          <p className="text-sm text-muted-foreground">Manage knowledge sources that ground your recommendations in real affiliate doctrine</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-stat-sources">{stats?.sources ?? 0}</p>
            <p className="text-xs text-muted-foreground">Sources</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-stat-documents">{stats?.documents ?? 0}</p>
            <p className="text-xs text-muted-foreground">Documents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-stat-chunks">{stats?.chunks ?? 0}</p>
            <p className="text-xs text-muted-foreground">Chunks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-stat-embedded">{stats?.embeddedChunks ?? 0}</p>
            <p className="text-xs text-muted-foreground">Embedded</p>
          </CardContent>
        </Card>
      </div>

      {stats && stats.sources === 0 && stats.chunks === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Knowledge base is empty</p>
              <p className="text-xs text-muted-foreground">Seed with curated CrossFit affiliate business doctrine from Two-Brain Business, Best Hour of Their Day, and CrossFit HQ</p>
            </div>
            <Button
              data-testid="button-seed-knowledge"
              onClick={() => seedKnowledge.mutate()}
              disabled={seedKnowledge.isPending}
            >
              {seedKnowledge.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
              Seed Knowledge Base
            </Button>
          </CardContent>
        </Card>
      )}

      {runningJobs.length > 0 && (
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="font-medium">Ingestion in progress</span>
              <span className="text-muted-foreground">
                ({runningJobs[0].videosProcessed}/{runningJobs[0].videosFound} videos, {runningJobs[0].chunksCreated} chunks)
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Source
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Source name (e.g. Two-Brain Business Playlist)"
            value={newSourceName}
            onChange={(e) => setNewSourceName(e.target.value)}
            data-testid="input-source-name"
          />
          <Input
            placeholder="YouTube URL (video or playlist)"
            value={newSourceUrl}
            onChange={(e) => setNewSourceUrl(e.target.value)}
            data-testid="input-source-url"
          />
          <Input
            placeholder="Description (optional)"
            value={newSourceDesc}
            onChange={(e) => setNewSourceDesc(e.target.value)}
            data-testid="input-source-description"
          />
          <Button
            onClick={() => createSource.mutate()}
            disabled={!newSourceName.trim() || !newSourceUrl.trim() || createSource.isPending}
            data-testid="button-add-source"
          >
            {createSource.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Add Source
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="w-4 h-4" />
            Sources ({sources?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sourcesLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : sources && sources.length > 0 ? (
            <div className="space-y-2">
              {sources.map((source) => (
                <SourceRow
                  key={source.id}
                  source={source}
                  expanded={expandedSource === source.id}
                  expandedDoc={expandedDoc}
                  onToggle={() => setExpandedSource(expandedSource === source.id ? null : source.id)}
                  onExpandDoc={(docId) => setExpandedDoc(expandedDoc === docId ? null : docId)}
                  onIngest={() => startIngest.mutate(source.id)}
                  onDelete={() => deleteSource.mutate(source.id)}
                  isIngesting={startIngest.isPending}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sources added yet. Add a YouTube video or playlist above to get started.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-4 h-4" />
            Search Knowledge Base
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search for affiliate doctrine (e.g. member onboarding best practices)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              data-testid="input-search-knowledge"
            />
            <Button onClick={handleSearch} disabled={searchMutation.isPending || !searchQuery.trim()} data-testid="button-search-knowledge">
              {searchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {searchMutation.isSuccess && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground" data-testid="text-search-empty">No results found. Try a different query or ingest more content.</p>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-3">
              {searchResults.map((result, i) => (
                <div key={result.chunkId} className="p-3 rounded-md bg-muted/30 space-y-2" data-testid={`search-result-${i}`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{result.docTitle}</span>
                      <Badge variant="outline" className="text-xs">{(result.similarity * 100).toFixed(0)}% match</Badge>
                    </div>
                    <a href={result.docUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1" data-testid={`link-search-source-${i}`}>
                      <ExternalLink className="w-3 h-3" />
                      Source
                    </a>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">{result.content}</p>
                  <div className="flex gap-1 flex-wrap">
                    {result.taxonomy?.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SourceRow({
  source,
  expanded,
  expandedDoc,
  onToggle,
  onExpandDoc,
  onIngest,
  onDelete,
  isIngesting,
}: {
  source: KnowledgeSource;
  expanded: boolean;
  expandedDoc: string | null;
  onToggle: () => void;
  onExpandDoc: (docId: string) => void;
  onIngest: () => void;
  onDelete: () => void;
  isIngesting: boolean;
}) {
  const { data: documents } = useQuery<DocumentSummary[]>({
    queryKey: ["/api/knowledge/sources", source.id, "documents"],
    enabled: expanded,
  });

  return (
    <div className="border rounded-md" data-testid={`source-row-${source.id}`}>
      <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={onToggle}>
        {expanded ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{source.name}</p>
          <p className="text-xs text-muted-foreground truncate">{source.url}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {source.lastIngestedAt && (
            <Badge variant="outline" className="text-xs">
              Ingested {new Date(source.lastIngestedAt).toLocaleDateString()}
            </Badge>
          )}
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onIngest(); }} disabled={isIngesting} data-testid={`button-ingest-${source.id}`}>
            <Play className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onDelete(); }} data-testid={`button-delete-${source.id}`}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t px-3 pb-3 pt-2">
          {documents && documents.length > 0 ? (
            <div className="space-y-1">
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  expanded={expandedDoc === doc.id}
                  onToggle={() => onExpandDoc(doc.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">No videos yet. Click the play button to start ingestion.</p>
          )}
        </div>
      )}
    </div>
  );
}

function DocumentRow({ doc, expanded, onToggle }: { doc: DocumentSummary; expanded: boolean; onToggle: () => void }) {
  const { data: chunks } = useQuery<ChunkSummary[]>({
    queryKey: ["/api/knowledge/documents", doc.id, "chunks"],
    enabled: expanded,
  });

  const statusColor: Record<string, string> = {
    processed: "default",
    pending: "secondary",
    no_transcript: "destructive",
  };

  return (
    <div>
      <div className="flex items-center gap-2 py-1.5 cursor-pointer text-sm" onClick={onToggle}>
        {expanded ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
        <FileText className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
        <span className="truncate flex-1">{doc.title}</span>
        <Badge variant={(statusColor[doc.status] as any) || "secondary"} className="text-xs">{doc.status}</Badge>
        <span className="text-xs text-muted-foreground flex-shrink-0">{doc.chunkCount} chunks</span>
      </div>

      {expanded && chunks && (
        <div className="ml-7 space-y-2 py-2">
          {chunks.map((chunk) => (
            <div key={chunk.id} className="p-2 rounded bg-muted/30 text-xs space-y-1">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-muted-foreground">#{chunk.chunkIndex}</span>
                <span className="text-muted-foreground">({chunk.tokenCount} tokens)</span>
                {chunk.hasEmbedding && <Badge variant="outline" className="text-xs">embedded</Badge>}
              </div>
              <p className="line-clamp-2">{chunk.content}</p>
              <div className="flex gap-1 flex-wrap">
                {chunk.taxonomy?.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
