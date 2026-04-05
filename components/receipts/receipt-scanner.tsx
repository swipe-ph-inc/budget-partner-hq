"use client";

import React, { useRef, useState } from "react";
import { Camera, Loader2, CheckCircle2, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ParsedReceipt } from "@/app/api/ai/parse-receipt/route";

export type { ParsedReceipt };

interface ReceiptScannerProps {
  onParsed: (result: ParsedReceipt, attachmentUrl: string | null) => void;
  className?: string;
}

export function ReceiptScanner({ onParsed, className }: ReceiptScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(file: File) {
    setStatus("loading");
    setErrorMsg(null);

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    const body = new FormData();
    body.append("file", file);

    try {
      const res = await fetch("/api/ai/parse-receipt", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "Could not process receipt.");
        return;
      }

      setStatus("done");
      onParsed(data.parsed as ParsedReceipt, data.attachment_url ?? null);
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFile(file);
    e.target.value = ""; // allow re-selecting the same file
  }

  function reset() {
    setStatus("idle");
    setErrorMsg(null);
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
  }

  return (
    <div className={cn(className)}>
      {/* Hidden file input — accept="image/*" lets mobile show camera + gallery sheet */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />

      {status === "idle" && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
        >
          <Camera className="h-4 w-4" />
          Scan receipt to auto-fill
        </button>
      )}

      {status === "loading" && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Receipt preview"
              className="h-12 w-12 rounded-md object-cover shrink-0 border border-border"
            />
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Reading receipt…
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 px-4 py-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Receipt preview"
              className="h-12 w-12 rounded-md object-cover shrink-0 border border-border"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Receipt scanned — fields pre-filled
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review and adjust before saving
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            title="Clear and scan another"
            onClick={reset}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">{errorMsg}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Try a clearer, well-lit photo
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            title="Try again"
            onClick={() => {
              reset();
              setTimeout(() => inputRef.current?.click(), 50);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
