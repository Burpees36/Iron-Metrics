import { useState, useRef, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  History,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
} from "lucide-react";

interface LeadColumnMapping {
  createdDate: number;
  source: number;
  stage: number;
  name: number;
  email: number;
  phone: number;
  coach: number;
  saleDate: number;
  salePrice: number;
  consultDate: number;
  lostReason: number;
  notes: number;
}

interface RowError {
  row: number;
  field: string;
  value: string;
  message: string;
}

interface PreviewData {
  headers: string[];
  sampleRows: string[][];
  totalRows: number;
  detectedMapping: LeadColumnMapping;
  mappingConfidence: Record<string, "high" | "medium" | "low" | "unmapped">;
  validationSummary: {
    validRows: number;
    errorRows: number;
    warningRows: number;
    errors: RowError[];
    warnings: RowError[];
  };
  uniqueStages: string[];
  detectedStageMapping: Record<string, string>;
  fileHash: string;
  isDuplicate: boolean;
  duplicateJobId: string | null;
  duplicateDate: string | null;
}

interface CommitResult {
  jobId: string;
  imported: number;
  updated: number;
  skipped: number;
  errorCount: number;
  errors: RowError[];
  totalRows: number;
  validRows: number;
}

interface ImportJob {
  id: string;
  filename: string;
  status: string;
  totalRows: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  createdAt: string;
  completedAt: string | null;
  uploadedBy: string;
}

type WizardStep = "upload" | "map" | "preview" | "result";

const LEAD_FIELDS: Record<string, { label: string; required: boolean; description: string }> = {
  createdDate: { label: "Lead Created Date", required: true, description: "When the lead entered your funnel" },
  source: { label: "Lead Source", required: false, description: "Where the lead came from (Referral, Facebook, etc.)" },
  stage: { label: "Stage / Outcome", required: false, description: "Current pipeline stage (New, Booked, Won, Lost, etc.)" },
  name: { label: "Name", required: false, description: "Lead's full name" },
  email: { label: "Email", required: false, description: "Used for deduplication" },
  phone: { label: "Phone", required: false, description: "Contact phone number" },
  coach: { label: "Assigned Coach", required: false, description: "Coach or sales rep handling the lead" },
  consultDate: { label: "Consult Date", required: false, description: "When the consultation was scheduled" },
  saleDate: { label: "Sale / Close Date", required: false, description: "When the sale was made" },
  salePrice: { label: "Sale Price / Monthly Rate", required: false, description: "Monthly membership price" },
  lostReason: { label: "Lost Reason", required: false, description: "Why the lead was lost" },
  notes: { label: "Notes", required: false, description: "Any additional details" },
};

const FIELD_ORDER = ["createdDate", "source", "stage", "name", "email", "phone", "coach", "consultDate", "saleDate", "salePrice", "lostReason", "notes"];

const SYSTEM_STAGES = [
  { value: "new", label: "New" },
  { value: "booked", label: "Booked" },
  { value: "showed", label: "Showed" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const STEP_LABELS: Record<WizardStep, string> = {
  upload: "Upload CSV",
  map: "Map Columns",
  preview: "Preview & Validate",
  result: "Import Results",
};

function confidenceBadge(conf: string) {
  switch (conf) {
    case "high": return <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px]">Auto-detected</Badge>;
    case "medium": return <Badge className="bg-amber-500/15 text-amber-400 text-[10px]">Likely match</Badge>;
    case "low": return <Badge className="bg-orange-500/15 text-orange-400 text-[10px]">Guess</Badge>;
    case "unmapped": return <Badge variant="outline" className="text-[10px] text-muted-foreground">Not mapped</Badge>;
    default: return null;
  }
}

export default function LeadImport() {
  const { id: gymId } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<LeadColumnMapping | null>(null);
  const [stageMapping, setStageMapping] = useState<Record<string, string>>({});
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "update" | "create">("skip");

  const { data: importHistory } = useQuery<ImportJob[]>({
    queryKey: ["/api/gyms", gymId, "leads", "imports"],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/leads/imports`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!gymId,
  });

  const previewMutation = useMutation({
    mutationFn: async ({ file, customMapping, customStageMapping }: { file: File; customMapping?: Partial<LeadColumnMapping>; customStageMapping?: Record<string, string> }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (customMapping) formData.append("mapping", JSON.stringify(customMapping));
      if (customStageMapping) formData.append("stageMapping", JSON.stringify(customStageMapping));
      const res = await fetch(`/api/gyms/${gymId}/leads/import/preview`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      return res.json() as Promise<PreviewData>;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setMapping(data.detectedMapping);
      setStageMapping(data.detectedStageMapping);
      if (step === "upload") setStep("map");
    },
    onError: (error: Error) => {
      toast({ title: "Preview failed", description: error.message, variant: "destructive" });
    },
  });

  const commitMutation = useMutation({
    mutationFn: async ({ file, finalMapping, finalStageMapping }: { file: File; finalMapping: LeadColumnMapping; finalStageMapping: Record<string, string> }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(finalMapping));
      formData.append("stageMapping", JSON.stringify(finalStageMapping));
      formData.append("duplicateMode", duplicateMode);
      const res = await fetch(`/api/gyms/${gymId}/leads/import/commit`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      return res.json() as Promise<CommitResult>;
    },
    onSuccess: (data) => {
      setCommitResult(data);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "leads", "imports"] });
      toast({ title: "Import complete", description: `${data.imported} created, ${data.updated} updated, ${data.skipped} skipped.` });
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv") {
      toast({ title: "Invalid file type", description: "Please upload a .csv file.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10 MB.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    setPreviewData(null);
    setMapping(null);
    setStageMapping({});
    setCommitResult(null);
    setExpandedErrors(false);
    previewMutation.mutate({ file });
  }, [toast, previewMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleMappingChange = (field: string, value: string) => {
    if (!mapping) return;
    const newMapping = { ...mapping, [field]: value === "skip" ? -1 : parseInt(value) };
    setMapping(newMapping);
  };

  const handleStageMappingChange = (rawStage: string, systemStage: string) => {
    setStageMapping(prev => ({ ...prev, [rawStage]: systemStage }));
  };

  const handleRevalidate = () => {
    if (selectedFile && mapping) {
      previewMutation.mutate({ file: selectedFile, customMapping: mapping, customStageMapping: stageMapping });
    }
  };

  const handleProceedToPreview = () => {
    if (!mapping) return;
    if (mapping.createdDate === -1) {
      toast({ title: "Mapping required", description: "Created Date column must be mapped.", variant: "destructive" });
      return;
    }
    if (selectedFile && mapping) {
      previewMutation.mutate({ file: selectedFile, customMapping: mapping, customStageMapping: stageMapping });
    }
    setStep("preview");
  };

  const handleCommit = () => {
    if (selectedFile && mapping) {
      commitMutation.mutate({ file: selectedFile, finalMapping: mapping, finalStageMapping: stageMapping });
    }
  };

  const resetWizard = () => {
    setStep("upload");
    setSelectedFile(null);
    setPreviewData(null);
    setMapping(null);
    setStageMapping({});
    setCommitResult(null);
    setExpandedErrors(false);
    setDuplicateMode("skip");
  };

  const steps: WizardStep[] = ["upload", "map", "preview", "result"];
  const stepIdx = steps.indexOf(step);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/gyms/${gymId}/pipeline`}>
              <Button variant="ghost" size="sm" data-testid="button-back-pipeline">
                <ArrowLeft className="w-4 h-4 mr-1" />Pipeline
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-lead-import">Import Lead Data</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload your historical lead and sales data to populate your pipeline and analytics.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)} data-testid="button-toggle-history">
          <History className="w-4 h-4 mr-1" />
          Import History
          {showHistory ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
        </Button>
      </div>

      {showHistory && (
        <Card>
          <CardHeader><CardTitle className="text-base">Import History</CardTitle></CardHeader>
          <CardContent>
            {!importHistory || importHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lead imports yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Skipped</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importHistory.map(job => (
                    <TableRow key={job.id} data-testid={`row-import-${job.id}`}>
                      <TableCell className="text-sm font-medium">{job.filename}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={job.status === "completed" ? "default" : "secondary"} className="text-[10px]">
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{job.totalRows}</TableCell>
                      <TableCell className="text-sm text-emerald-400">{job.importedCount}</TableCell>
                      <TableCell className="text-sm text-blue-400">{job.updatedCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{job.skippedCount}</TableCell>
                      <TableCell className="text-sm text-red-400">{job.errorCount > 0 ? job.errorCount : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 text-sm">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-border" />}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              i < stepIdx ? "bg-emerald-500/15 text-emerald-400" :
              i === stepIdx ? "bg-primary/15 text-primary" :
              "bg-muted text-muted-foreground"
            }`}>
              {i < stepIdx ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
              {STEP_LABELS[s]}
            </div>
          </div>
        ))}
      </div>

      {step === "upload" && (
        <Card>
          <CardContent className="pt-6">
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone-upload"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                data-testid="input-file"
              />
              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-base font-medium mb-1">Drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mb-4">or click to browse — CSV files up to 10 MB</p>
              <p className="text-xs text-muted-foreground">Expected columns: Lead Date, Source, Stage/Outcome, Name, Coach, Sale Price, etc.</p>
            </div>
            {previewMutation.isPending && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing your file...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "map" && previewData && mapping && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Column Mapping</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{previewData.totalRows} rows detected</Badge>
                  <Badge variant="outline">{previewData.headers.length} columns</Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {previewData.isDuplicate && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-400">This file was imported before</p>
                    <p className="text-muted-foreground">Imported on {previewData.duplicateDate ? new Date(previewData.duplicateDate).toLocaleDateString() : "previously"}. Proceeding will use duplicate detection to prevent double-counting.</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {FIELD_ORDER.map(field => {
                  const info = LEAD_FIELDS[field];
                  const conf = previewData.mappingConfidence[field];
                  const currentVal = (mapping as any)[field];

                  return (
                    <div key={field} className="flex items-center gap-4">
                      <div className="w-48 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">{info.label}</span>
                          {info.required && <span className="text-red-400 text-xs">*</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{info.description}</p>
                      </div>
                      <Select
                        value={currentVal === -1 ? "skip" : String(currentVal)}
                        onValueChange={(v) => handleMappingChange(field, v)}
                      >
                        <SelectTrigger className="w-56" data-testid={`select-map-${field}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">— Skip —</SelectItem>
                          {previewData.headers.map((h, i) => (
                            <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex-shrink-0">{confidenceBadge(conf)}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {previewData.uniqueStages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stage Mapping</CardTitle>
                <p className="text-sm text-muted-foreground">Map your spreadsheet stage names to system pipeline stages.</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {previewData.uniqueStages.map(rawStage => (
                    <div key={rawStage} className="flex items-center gap-4">
                      <div className="w-48 flex-shrink-0">
                        <Badge variant="outline" className="text-xs">{rawStage}</Badge>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <Select
                        value={stageMapping[rawStage] || "new"}
                        onValueChange={(v) => handleStageMappingChange(rawStage, v)}
                      >
                        <SelectTrigger className="w-40" data-testid={`select-stage-${rawStage}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SYSTEM_STAGES.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={resetWizard} data-testid="button-back-upload">
              <ArrowLeft className="w-4 h-4 mr-1" />Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRevalidate} disabled={previewMutation.isPending} data-testid="button-revalidate">
                <RefreshCw className={`w-4 h-4 mr-1 ${previewMutation.isPending ? "animate-spin" : ""}`} />
                Revalidate
              </Button>
              <Button onClick={handleProceedToPreview} data-testid="button-proceed-preview">
                Preview Data <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === "preview" && previewData && mapping && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold" data-testid="text-total-rows">{previewData.totalRows}</p>
                <p className="text-xs text-muted-foreground">Total Rows</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-emerald-400" data-testid="text-valid-rows">{previewData.validationSummary.validRows}</p>
                <p className="text-xs text-muted-foreground">Valid</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-red-400" data-testid="text-error-rows">{previewData.validationSummary.errorRows}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-amber-400" data-testid="text-warning-rows">{previewData.validationSummary.warningRows}</p>
                <p className="text-xs text-muted-foreground">Warnings</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Duplicate Handling</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button
                  variant={duplicateMode === "skip" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDuplicateMode("skip")}
                  data-testid="button-dupe-skip"
                >
                  Skip Duplicates
                </Button>
                <Button
                  variant={duplicateMode === "update" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDuplicateMode("update")}
                  data-testid="button-dupe-update"
                >
                  Update Existing
                </Button>
                <Button
                  variant={duplicateMode === "create" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDuplicateMode("create")}
                  data-testid="button-dupe-create"
                >
                  Create Anyway
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Duplicates are detected by matching email + created date, name + created date, or email + consult date.
              </p>
            </CardContent>
          </Card>

          {previewData.validationSummary.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  Validation Errors ({previewData.validationSummary.errors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-48 overflow-auto">
                  {previewData.validationSummary.errors.slice(0, expandedErrors ? 100 : 10).map((err, i) => (
                    <div key={i} className="text-xs flex gap-2">
                      <span className="text-muted-foreground">Row {err.row}</span>
                      <Badge variant="outline" className="text-[9px]">{err.field}</Badge>
                      <span className="text-red-400">{err.message}</span>
                    </div>
                  ))}
                </div>
                {previewData.validationSummary.errors.length > 10 && (
                  <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setExpandedErrors(!expandedErrors)} data-testid="button-expand-errors">
                    {expandedErrors ? "Show less" : `Show all ${previewData.validationSummary.errors.length} errors`}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {previewData.validationSummary.warnings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  Warnings ({previewData.validationSummary.warnings.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {previewData.validationSummary.warnings.slice(0, 10).map((w, i) => (
                    <div key={i} className="text-xs flex gap-2">
                      <span className="text-muted-foreground">Row {w.row}</span>
                      <Badge variant="outline" className="text-[9px]">{w.field}</Badge>
                      <span className="text-amber-400">{w.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview (first 20 rows)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewData.headers.map((h, i) => (
                        <TableHead key={i} className="text-xs whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.sampleRows.slice(0, 20).map((row, ri) => (
                      <TableRow key={ri}>
                        {row.map((cell, ci) => (
                          <TableCell key={ci} className="text-xs whitespace-nowrap max-w-[200px] truncate">{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("map")} data-testid="button-back-map">
              <ArrowLeft className="w-4 h-4 mr-1" />Back to Mapping
            </Button>
            <Button
              onClick={handleCommit}
              disabled={commitMutation.isPending || previewData.validationSummary.validRows === 0}
              data-testid="button-commit-import"
            >
              {commitMutation.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Importing...</>
              ) : (
                <>Import {previewData.validationSummary.validRows} Leads</>
              )}
            </Button>
          </div>
        </div>
      )}

      {step === "result" && commitResult && (
        <Card>
          <CardContent className="pt-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold" data-testid="heading-import-complete">Import Complete</h2>
              <p className="text-sm text-muted-foreground mt-1">Your lead data has been processed.</p>
            </div>

            <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto">
              <div>
                <p className="text-2xl font-bold text-emerald-400" data-testid="text-imported">{commitResult.imported}</p>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400" data-testid="text-updated">{commitResult.updated}</p>
                <p className="text-xs text-muted-foreground">Updated</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground" data-testid="text-skipped">{commitResult.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400" data-testid="text-errors">{commitResult.errorCount}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>

            {commitResult.errors.length > 0 && (
              <div className="text-left max-w-lg mx-auto">
                <Button variant="ghost" size="sm" className="text-xs mb-2" onClick={() => setExpandedErrors(!expandedErrors)} data-testid="button-expand-result-errors">
                  <AlertCircle className="w-3 h-3 mr-1 text-red-400" />
                  {expandedErrors ? "Hide errors" : `View ${commitResult.errors.length} errors`}
                </Button>
                {expandedErrors && (
                  <div className="space-y-1 max-h-48 overflow-auto border rounded-lg p-3">
                    {commitResult.errors.slice(0, 50).map((err, i) => (
                      <div key={i} className="text-xs flex gap-2">
                        <span className="text-muted-foreground">Row {err.row}</span>
                        <span className="text-red-400">{err.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={resetWizard} data-testid="button-import-another">
                Import Another File
              </Button>
              <Link href={`/gyms/${gymId}/pipeline`}>
                <Button data-testid="button-view-pipeline">
                  View Pipeline <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
