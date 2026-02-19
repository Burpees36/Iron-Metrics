import { useState, useRef, useCallback } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
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
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  X,
  History,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";

interface ColumnMapping {
  name: number;
  email: number;
  status: number;
  joinDate: number;
  cancelDate: number;
  monthlyRate: number;
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
  detectedMapping: ColumnMapping;
  mappingConfidence: Record<string, "high" | "medium" | "low" | "unmapped">;
  validationSummary: {
    validRows: number;
    errorRows: number;
    errors: RowError[];
  };
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

interface ImportJobSummary {
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
}

type WizardStep = "upload" | "map" | "preview" | "result";

const FIELD_LABELS: Record<string, { label: string; required: boolean; description: string }> = {
  name: { label: "Member Name", required: true, description: "Full name of the member" },
  email: { label: "Email Address", required: false, description: "Used for deduplication" },
  status: { label: "Membership Status", required: false, description: "Active, cancelled, etc." },
  joinDate: { label: "Join Date", required: true, description: "When they signed up" },
  cancelDate: { label: "Cancel Date", required: false, description: "When they left (if applicable)" },
  monthlyRate: { label: "Monthly Rate", required: false, description: "Monthly membership fee" },
};

const FIELD_ORDER = ["name", "email", "status", "joinDate", "cancelDate", "monthlyRate"];

export default function CsvImport() {
  const [, params] = useRoute("/gyms/:id/import");
  const gymId = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState(false);

  const { data: importHistory } = useQuery<ImportJobSummary[]>({
    queryKey: [`/api/gyms/${gymId}/imports`],
    enabled: !!gymId,
  });

  const previewMutation = useMutation({
    mutationFn: async ({ file, customMapping }: { file: File; customMapping?: Partial<ColumnMapping> }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (customMapping) {
        formData.append("mapping", JSON.stringify(customMapping));
      }
      const res = await fetch(`/api/gyms/${gymId}/import/preview`, {
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
      setStep("map");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Preview failed", description: error.message, variant: "destructive" });
    },
  });

  const remapMutation = useMutation({
    mutationFn: async ({ file, customMapping }: { file: File; customMapping: ColumnMapping }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(customMapping));
      const res = await fetch(`/api/gyms/${gymId}/import/preview`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to re-preview");
      return res.json() as Promise<PreviewData>;
    },
    onSuccess: (data) => {
      setPreviewData(data);
    },
  });

  const commitMutation = useMutation({
    mutationFn: async ({ file, finalMapping }: { file: File; finalMapping: ColumnMapping }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(finalMapping));
      const res = await fetch(`/api/gyms/${gymId}/import/commit`, {
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
      queryClient.invalidateQueries({ queryKey: [`/api/gyms/${gymId}/members`] });
      queryClient.invalidateQueries({ queryKey: [`/api/gyms/${gymId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/gyms/${gymId}/imports`] });
      toast({ title: "Import complete", description: `${data.imported} new, ${data.updated} updated.` });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
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
    setCommitResult(null);
    setExpandedErrors(false);
    previewMutation.mutate({ file });
  }, [toast, previewMutation]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleMappingChange = (field: string, value: string) => {
    if (!mapping) return;
    const newMapping = { ...mapping, [field]: value === "skip" ? -1 : parseInt(value) };
    setMapping(newMapping);
  };

  const handleRevalidate = () => {
    if (selectedFile && mapping) {
      remapMutation.mutate({ file: selectedFile, customMapping: mapping });
    }
  };

  const handleProceedToPreview = () => {
    if (!mapping) return;
    if (mapping.name === -1) {
      toast({ title: "Mapping required", description: "Name column must be mapped.", variant: "destructive" });
      return;
    }
    if (mapping.joinDate === -1) {
      toast({ title: "Mapping required", description: "Join Date column must be mapped.", variant: "destructive" });
      return;
    }
    if (selectedFile && mapping) {
      remapMutation.mutate({ file: selectedFile, customMapping: mapping });
    }
    setStep("preview");
  };

  const handleCommit = () => {
    if (selectedFile && mapping) {
      commitMutation.mutate({ file: selectedFile, finalMapping: mapping });
    }
  };

  const resetWizard = () => {
    setStep("upload");
    setSelectedFile(null);
    setPreviewData(null);
    setMapping(null);
    setCommitResult(null);
    setExpandedErrors(false);
  };

  const confidenceBadge = (level: "high" | "medium" | "low" | "unmapped") => {
    const variants: Record<string, string> = {
      high: "bg-primary/10 text-primary",
      medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
      low: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      unmapped: "bg-muted text-muted-foreground",
    };
    return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${variants[level]}`}>{level}</span>;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="space-y-1">
        <Link href={`/gyms/${gymId}`}>
          <Button variant="ghost" size="sm" className="mb-2" data-testid="button-back-to-gym">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Gym
          </Button>
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-import-title">
            Import Members
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            data-testid="button-toggle-history"
          >
            <History className="w-4 h-4 mr-1" />
            Import History
            {showHistory ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </Button>
        </div>
      </div>

      {showHistory && (
        <ImportHistoryPanel history={importHistory || []} gymId={gymId || ""} />
      )}

      <StepIndicator currentStep={step} />

      {step === "upload" && (
        <UploadStep
          dragOver={dragOver}
          setDragOver={setDragOver}
          handleDrop={handleDrop}
          handleFile={handleFile}
          fileInputRef={fileInputRef}
          isLoading={previewMutation.isPending}
          error={previewMutation.error}
        />
      )}

      {step === "map" && previewData && mapping && (
        <MappingStep
          previewData={previewData}
          mapping={mapping}
          onMappingChange={handleMappingChange}
          onRevalidate={handleRevalidate}
          onBack={resetWizard}
          onProceed={handleProceedToPreview}
          isRevalidating={remapMutation.isPending}
          confidenceBadge={confidenceBadge}
        />
      )}

      {step === "preview" && previewData && mapping && (
        <PreviewStep
          previewData={previewData}
          mapping={mapping}
          onBack={() => setStep("map")}
          onCommit={handleCommit}
          isCommitting={commitMutation.isPending}
          expandedErrors={expandedErrors}
          setExpandedErrors={setExpandedErrors}
        />
      )}

      {step === "result" && commitResult && (
        <ResultStep
          result={commitResult}
          onReset={resetWizard}
          gymId={gymId || ""}
          expandedErrors={expandedErrors}
          setExpandedErrors={setExpandedErrors}
        />
      )}
    </div>
  );
}

function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const steps: { key: WizardStep; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "map", label: "Map Columns" },
    { key: "preview", label: "Validate" },
    { key: "result", label: "Complete" },
  ];

  const stepOrder = ["upload", "map", "preview", "result"];
  const currentIdx = stepOrder.indexOf(currentStep);

  return (
    <div className="flex items-center gap-1" data-testid="step-indicator">
      {steps.map((s, i) => {
        const isActive = s.key === currentStep;
        const isComplete = i < currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isComplete
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
              data-testid={`step-${s.key}`}
            >
              {isComplete ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
              <span>{s.label}</span>
            </div>
            {i < steps.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
          </div>
        );
      })}
    </div>
  );
}

function UploadStep({
  dragOver,
  setDragOver,
  handleDrop,
  handleFile,
  fileInputRef,
  isLoading,
  error,
}: {
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFile: (f: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  isLoading: boolean;
  error: Error | null;
}) {
  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="space-y-2">
          <h3 className="font-semibold text-sm" data-testid="text-upload-heading">Upload Your Member Data</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Upload a CSV export from your gym management software. We support exports from Wodify, PushPress, Zen Planner, and most other platforms.
            The system will automatically detect your column format and guide you through mapping.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Name", note: "required" },
            { label: "Email", note: "optional" },
            { label: "Status", note: "optional" },
            { label: "Join Date", note: "required" },
            { label: "Cancel Date", note: "optional" },
            { label: "Monthly Rate", note: "optional" },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-1.5 text-xs">
              <div className={`w-1.5 h-1.5 rounded-full ${f.note === "required" ? "bg-primary" : "bg-muted-foreground/40"}`} />
              <span className="text-muted-foreground">{f.label}</span>
              {f.note === "required" && <span className="text-[10px] text-primary font-medium">required</span>}
            </div>
          ))}
        </div>

        <div
          className={`border-2 border-dashed rounded-md p-8 text-center transition-colors cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : "border-border"
          } ${isLoading ? "opacity-60 pointer-events-none" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          data-testid="dropzone-csv"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            data-testid="input-file-csv"
          />
          {isLoading ? (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm font-medium">Analyzing your file...</p>
            </div>
          ) : (
            <>
              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Drop your CSV here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Supports .csv files up to 10 MB</p>
            </>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/30 flex items-start gap-2" data-testid="upload-error">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error.message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MappingStep({
  previewData,
  mapping,
  onMappingChange,
  onRevalidate,
  onBack,
  onProceed,
  isRevalidating,
  confidenceBadge,
}: {
  previewData: PreviewData;
  mapping: ColumnMapping;
  onMappingChange: (field: string, value: string) => void;
  onRevalidate: () => void;
  onBack: () => void;
  onProceed: () => void;
  isRevalidating: boolean;
  confidenceBadge: (level: "high" | "medium" | "low" | "unmapped") => JSX.Element;
}) {
  return (
    <div className="space-y-4">
      {previewData.isDuplicate && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium" data-testid="text-duplicate-warning">Duplicate file detected</p>
              <p className="text-xs text-muted-foreground mt-1">
                This file was previously imported on {previewData.duplicateDate ? new Date(previewData.duplicateDate).toLocaleDateString() : "unknown date"}.
                You can still re-import to update existing records.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <CardTitle className="text-base" data-testid="text-mapping-title">Map Your Columns</CardTitle>
          <Badge variant="outline">{previewData.totalRows} rows detected</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            We detected {previewData.headers.length} columns in your file. Match each column to the correct field below.
            Adjust any incorrect mappings before proceeding.
          </p>

          <div className="space-y-3" data-testid="mapping-fields">
            {FIELD_ORDER.map((field) => {
              const info = FIELD_LABELS[field];
              const currentValue = (mapping as any)[field];
              const confidence = previewData.mappingConfidence[field];

              return (
                <div key={field} className="flex flex-wrap items-center gap-3 p-3 rounded-md bg-muted/30" data-testid={`mapping-field-${field}`}>
                  <div className="flex-1 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{info.label}</span>
                      {info.required && <span className="text-[10px] text-primary font-semibold">REQUIRED</span>}
                      {confidenceBadge(confidence)}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{info.description}</p>
                  </div>
                  <div className="w-[220px]">
                    <Select
                      value={currentValue === -1 ? "skip" : String(currentValue)}
                      onValueChange={(val) => onMappingChange(field, val)}
                    >
                      <SelectTrigger className="h-9" data-testid={`select-mapping-${field}`}>
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">-- Skip / Not in file --</SelectItem>
                        {previewData.headers.map((h, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {h || `Column ${i + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t pt-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Data Preview (first 5 rows)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="table-preview-sample">
                <thead>
                  <tr>
                    {previewData.headers.map((h, i) => (
                      <th key={i} className="text-left p-1.5 border-b font-medium text-muted-foreground whitespace-nowrap">
                        {h || `Col ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.sampleRows.slice(0, 5).map((row, ri) => (
                    <tr key={ri} className="border-b border-border/50">
                      {row.map((cell, ci) => (
                        <td key={ci} className="p-1.5 whitespace-nowrap max-w-[200px] truncate">
                          {cell || <span className="text-muted-foreground/50">empty</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="outline" onClick={onBack} data-testid="button-back-upload">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onRevalidate} disabled={isRevalidating} data-testid="button-revalidate">
            <RefreshCw className={`w-4 h-4 mr-1 ${isRevalidating ? "animate-spin" : ""}`} />
            Re-validate
          </Button>
          <Button onClick={onProceed} data-testid="button-proceed-preview">
            Validate & Preview
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreviewStep({
  previewData,
  mapping,
  onBack,
  onCommit,
  isCommitting,
  expandedErrors,
  setExpandedErrors,
}: {
  previewData: PreviewData;
  mapping: ColumnMapping;
  onBack: () => void;
  onCommit: () => void;
  isCommitting: boolean;
  expandedErrors: boolean;
  setExpandedErrors: (v: boolean) => void;
}) {
  const { validationSummary } = previewData;
  const hasErrors = validationSummary.errorRows > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base" data-testid="text-validation-title">Validation Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="p-3 rounded-md bg-muted/50 text-center" data-testid="stat-total-rows">
              <p className="text-2xl font-bold font-mono">{previewData.totalRows}</p>
              <p className="text-[11px] text-muted-foreground">Total Rows</p>
            </div>
            <div className="p-3 rounded-md bg-primary/5 text-center" data-testid="stat-valid-rows">
              <p className="text-2xl font-bold font-mono text-primary">{validationSummary.validRows}</p>
              <p className="text-[11px] text-muted-foreground">Valid</p>
            </div>
            <div className={`p-3 rounded-md text-center ${hasErrors ? "bg-red-50 dark:bg-red-900/20" : "bg-muted/50"}`} data-testid="stat-error-rows">
              <p className={`text-2xl font-bold font-mono ${hasErrors ? "text-red-700 dark:text-red-400" : ""}`}>{validationSummary.errorRows}</p>
              <p className="text-[11px] text-muted-foreground">Errors (will skip)</p>
            </div>
            <div className="p-3 rounded-md bg-muted/50 text-center" data-testid="stat-success-rate">
              <p className="text-2xl font-bold font-mono">
                {previewData.totalRows > 0 ? Math.round((validationSummary.validRows / previewData.totalRows) * 100) : 0}%
              </p>
              <p className="text-[11px] text-muted-foreground">Success Rate</p>
            </div>
          </div>

          {hasErrors && (
            <div className="space-y-2">
              <button
                className="flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400"
                onClick={() => setExpandedErrors(!expandedErrors)}
                data-testid="button-toggle-errors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {validationSummary.errors.length} validation issues found
                {expandedErrors ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {expandedErrors && (
                <div className="max-h-[200px] overflow-y-auto border rounded-md" data-testid="error-list">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="text-left p-2 font-medium">Row</th>
                        <th className="text-left p-2 font-medium">Field</th>
                        <th className="text-left p-2 font-medium">Value</th>
                        <th className="text-left p-2 font-medium">Issue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationSummary.errors.slice(0, 50).map((err, i) => (
                        <tr key={i} className="border-t border-border/50" data-testid={`error-row-${i}`}>
                          <td className="p-2 font-mono">{err.row}</td>
                          <td className="p-2">{err.field}</td>
                          <td className="p-2 max-w-[120px] truncate text-muted-foreground">{err.value || "(empty)"}</td>
                          <td className="p-2 text-red-700 dark:text-red-400">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {validationSummary.validRows === 0 && (
            <div className="p-4 rounded-md bg-red-50 dark:bg-red-950/30 flex items-start gap-2" data-testid="no-valid-rows-warning">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">No valid rows to import</p>
                <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                  All rows have validation errors. Go back to fix column mapping or check your file format.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="outline" onClick={onBack} data-testid="button-back-map">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Adjust Mapping
        </Button>
        <Button
          onClick={onCommit}
          disabled={isCommitting || validationSummary.validRows === 0}
          data-testid="button-commit-import"
        >
          {isCommitting ? (
            <>
              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-1" />
              Import {validationSummary.validRows} Members
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ResultStep({
  result,
  onReset,
  gymId,
  expandedErrors,
  setExpandedErrors,
}: {
  result: CommitResult;
  onReset: () => void;
  gymId: string;
  expandedErrors: boolean;
  setExpandedErrors: (v: boolean) => void;
}) {
  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-3" data-testid="import-result-header">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold" data-testid="text-import-complete">Import Complete</h3>
            <p className="text-xs text-muted-foreground">
              Processed {result.totalRows} rows successfully
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="p-3 rounded-md bg-primary/5 text-center" data-testid="result-imported">
            <p className="text-2xl font-bold font-mono text-primary">{result.imported}</p>
            <p className="text-[11px] text-muted-foreground">New Members</p>
          </div>
          <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 text-center" data-testid="result-updated">
            <p className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-400">{result.updated}</p>
            <p className="text-[11px] text-muted-foreground">Updated</p>
          </div>
          <div className="p-3 rounded-md bg-muted/50 text-center" data-testid="result-skipped">
            <p className="text-2xl font-bold font-mono">{result.skipped}</p>
            <p className="text-[11px] text-muted-foreground">Skipped</p>
          </div>
          <div className={`p-3 rounded-md text-center ${result.errorCount > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-muted/50"}`} data-testid="result-errors">
            <p className={`text-2xl font-bold font-mono ${result.errorCount > 0 ? "text-red-700 dark:text-red-400" : ""}`}>{result.errorCount}</p>
            <p className="text-[11px] text-muted-foreground">Errors</p>
          </div>
        </div>

        {result.errors.length > 0 && (
          <div className="space-y-2">
            <button
              className="flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400"
              onClick={() => setExpandedErrors(!expandedErrors)}
              data-testid="button-toggle-result-errors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {result.errors.length} rows had issues
              {expandedErrors ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {expandedErrors && (
              <div className="max-h-[200px] overflow-y-auto border rounded-md" data-testid="result-error-list">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="text-left p-2 font-medium">Row</th>
                      <th className="text-left p-2 font-medium">Field</th>
                      <th className="text-left p-2 font-medium">Value</th>
                      <th className="text-left p-2 font-medium">Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.slice(0, 50).map((err, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-2 font-mono">{err.row}</td>
                        <td className="p-2">{err.field}</td>
                        <td className="p-2 max-w-[120px] truncate text-muted-foreground">{err.value || "(empty)"}</td>
                        <td className="p-2 text-red-700 dark:text-red-400">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" onClick={onReset} data-testid="button-import-another">
            Import Another File
          </Button>
          <Link href={`/gyms/${gymId}`}>
            <Button data-testid="button-view-gym">
              View Gym Dashboard
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ImportHistoryPanel({ history, gymId }: { history: ImportJobSummary[]; gymId: string }) {
  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-sm text-muted-foreground" data-testid="text-no-history">
          No import history yet. Upload your first CSV to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm" data-testid="text-history-title">Import History</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[250px] overflow-y-auto">
          <table className="w-full text-xs" data-testid="table-import-history">
            <thead className="sticky top-0 bg-card border-b">
              <tr>
                <th className="text-left p-3 font-medium">File</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">New</th>
                <th className="text-right p-3 font-medium">Updated</th>
                <th className="text-right p-3 font-medium">Errors</th>
                <th className="text-right p-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((job) => (
                <tr key={job.id} className="border-t border-border/50" data-testid={`history-row-${job.id}`}>
                  <td className="p-3 max-w-[180px] truncate">
                    <div className="flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span>{job.filename}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={job.status === "completed" ? "secondary" : job.status === "failed" ? "destructive" : "outline"}
                      className="text-[10px]"
                    >
                      {job.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right font-mono">{job.importedCount}</td>
                  <td className="p-3 text-right font-mono">{job.updatedCount}</td>
                  <td className="p-3 text-right font-mono">{job.errorCount > 0 ? <span className="text-red-600 dark:text-red-400">{job.errorCount}</span> : "0"}</td>
                  <td className="p-3 text-right text-muted-foreground">
                    {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
