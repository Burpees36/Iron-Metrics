import { useState, useRef, useCallback } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  X,
} from "lucide-react";

export default function CsvImport() {
  const [, params] = useRoute("/gyms/:id/import");
  const gymId = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/gyms/${gymId}/import/members`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId] });
      toast({ title: "Import complete", description: `${data.imported} members imported, ${data.updated} updated.` });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Invalid file", description: "Please upload a CSV file.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    setResult(null);
  }, [toast]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleUpload = () => {
    if (selectedFile) {
      mutation.mutate(selectedFile);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <Link href={`/gyms/${gymId}`}>
          <Button variant="ghost" size="sm" className="mb-2" data-testid="button-back-to-gym">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Gym
          </Button>
        </Link>
        <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-import-title">
          Import Members
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload a CSV file to import or update your member roster.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">CSV Format</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your CSV should include columns for: <code className="bg-muted px-1 py-0.5 rounded text-xs">name</code>,{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">email</code>,{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">status</code> (active/cancelled),{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">join_date</code> (YYYY-MM-DD),{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">cancel_date</code> (optional),{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">monthly_rate</code>.
            </p>
          </div>

          <div
            className={`border-2 border-dashed rounded-md p-8 text-center transition-colors cursor-pointer ${
              dragOver ? "border-primary bg-primary/5" : "border-border"
            }`}
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
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Drop your CSV here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">Supports .csv files</p>
          </div>

          {selectedFile && !result && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-md bg-muted/50">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" data-testid="text-file-name">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedFile(null)}
                  data-testid="button-remove-file"
                >
                  <X className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={mutation.isPending}
                  data-testid="button-upload-csv"
                >
                  {mutation.isPending ? "Importing..." : "Import"}
                </Button>
              </div>
            </div>
          )}

          {result && (
            <div className="p-4 rounded-md bg-emerald-50 dark:bg-emerald-950/30 space-y-3" data-testid="import-result">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-semibold text-sm">Import Successful</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{result.imported} new</Badge>
                <Badge variant="secondary">{result.updated} updated</Badge>
                <Badge variant="outline">{result.skipped} skipped</Badge>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedFile(null);
                    setResult(null);
                  }}
                  data-testid="button-import-another"
                >
                  Import Another
                </Button>
                <Link href={`/gyms/${gymId}`}>
                  <Button size="sm" data-testid="button-view-gym">
                    View Gym
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {mutation.isError && !result && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/30 flex items-start gap-2" data-testid="import-error">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">
                {mutation.error?.message || "An error occurred during import."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
