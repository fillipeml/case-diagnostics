"use client";

import { useCallback, useRef, useState } from "react";

interface UploadZoneProps {
  file: File | null;
  onSelect: (file: File) => void;
  maxUploadMb: number;
  disabled?: boolean;
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export default function UploadZone({ file, onSelect, maxUploadMb, disabled }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const take = useCallback(
    (candidate: File | undefined) => {
      if (!candidate) return;
      if (!isPdf(candidate)) {
        setRejected("Only PDF files are accepted.");
        return;
      }
      if (candidate.size > maxUploadMb * 1024 * 1024) {
        setRejected(`The file exceeds ${maxUploadMb} MB.`);
        return;
      }
      setRejected(null);
      onSelect(candidate);
    },
    [maxUploadMb, onSelect],
  );

  const border = rejected
    ? "border-red-300 bg-bad-soft"
    : dragging
      ? "border-accent bg-accent-soft"
      : file
        ? "border-accent/60 bg-white"
        : "border-line bg-surface hover:border-muted";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Choose the PDF of the case file"
      className={`rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${border} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) take(e.dataTransfer.files[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {file ? (
        <>
          <p className="text-sm font-semibold text-ink">{file.name}</p>
          <p className="mt-1 text-xs text-muted">
            {(file.size / 1024 / 1024).toFixed(2)} MB · click to replace
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-ink">Drop the case file here</p>
          <p className="mt-1 text-xs text-muted">
            or click to choose · the full PDF downloaded from the court · up to {maxUploadMb} MB
          </p>
        </>
      )}
      {rejected && <p className="mt-3 text-xs font-semibold text-bad">{rejected}</p>}
    </div>
  );
}
