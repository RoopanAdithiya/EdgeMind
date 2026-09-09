/*
 * CodeEditor — monospace code input panel
 * Design: Laboratory Terminal
 */
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Trash2, AlertCircle, CheckCircle2, Upload } from "lucide-react";

interface CodeEditorProps {
  code: string;
  setCode: (code: string) => void;
  fileName: string | null;
  onFileUpload: (file: File) => void;
  isLoading: boolean;
  apiStatus: "connected" | "disconnected" | "checking";
  error: string | null;
  onAnalyze: () => void;
  onClear: () => void;
  hasResults: boolean;
}

export default function CodeEditor({
  code,
  setCode,
  fileName,
  onFileUpload,
  isLoading,
  apiStatus,
  error,
  onAnalyze,
  onClear,
  hasResults,
}: CodeEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
    // reset so selecting the same file again still fires onChange
    e.target.value = "";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Editor header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[oklch(0.65_0.20_25)]" />
            <div className="w-3 h-3 rounded-full bg-[oklch(0.72_0.18_80)]" />
            <div className="w-3 h-3 rounded-full bg-[oklch(0.70_0.15_145)]" />
          </div>
          <span className="font-mono text-xs text-muted-foreground ml-2">
            {fileName || "source.py"}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".py"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => fileInputRef.current?.click()}
            title="Upload .py file"
            className="text-muted-foreground hover:text-foreground"
          >
            <Upload className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            {apiStatus === "checking" && (
              <>
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
                <span className="text-muted-foreground">checking...</span>
              </>
            )}
            {apiStatus === "connected" && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[oklch(0.70_0.15_145)]" />
                <span className="text-[oklch(0.70_0.15_145)]">connected</span>
              </>
            )}
            {apiStatus === "disconnected" && (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-[oklch(0.65_0.20_25)]" />
                <span className="text-[oklch(0.65_0.20_25)]">offline</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex-1 relative">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste your Python code here...

def isEligible(age):
    if age >= 18:
        return True
    return False"
          spellCheck={false}
          className="w-full h-full resize-none bg-[oklch(0.16_0.005_260)] text-foreground font-mono text-sm leading-[1.7] p-4 outline-none placeholder:text-muted-foreground/40 selection:bg-primary/20"
        />
      </div>

      {/* Editor footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border gap-2">
        <div className="text-xs text-muted-foreground font-mono">
          {code.split("\n").length} lines
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
            disabled={!code || isLoading}
            className="font-mono text-xs h-8 gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </Button>
          <Button
            onClick={onAnalyze}
            disabled={!code || isLoading}
            className="font-mono text-xs h-8 gap-1.5 px-4"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {isLoading ? "Analyzing..." : hasResults ? "Re-analyze" : "Run Analysis"}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2.5 bg-[oklch(0.65_0.20_25_/_10%)] border-t border-[oklch(0.65_0.20_25_/_20%)]">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[oklch(0.65_0.20_25)] shrink-0 mt-0.5" />
            <p className="text-sm text-[oklch(0.75_0.15_25)]">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
