"use client";

import { useCallback, useEffect, useId, useState } from "react";

import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";

import { reportError } from "@repo/utils";

import { getCroppedAvatarFile } from "../../lib/crop-avatar";

import "react-easy-crop/react-easy-crop.css";

type AdminAvatarCropDialogProps = {
  imageSrc: string;
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
};

export function AdminAvatarCropDialog({
  imageSrc,
  open,
  busy = false,
  onCancel,
  onConfirm,
}: AdminAvatarCropDialogProps) {
  const titleId = useId();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, [open, imageSrc]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy && !preparing) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, preparing, onCancel]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels || busy || preparing) return;
    setPreparing(true);
    try {
      const file = await getCroppedAvatarFile(imageSrc, croppedAreaPixels);
      await onConfirm(file);
    } catch (error) {
      reportError(error, { action: "admin-avatar-crop" });
      toast.error("Could not crop image");
    } finally {
      setPreparing(false);
    }
  }

  if (!open) return null;

  const disabled = busy || preparing;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-brand-night/75 backdrop-blur-sm"
        aria-label="Close crop dialog"
        disabled={disabled}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-brand-night/30"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              Crop avatar
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Drag to frame your photo, then zoom and apply.
            </p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={onCancel}
            className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        <div className="relative h-72 bg-slate-900 sm:h-80">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Zoom
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              disabled={disabled}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="mt-2 w-full accent-brand-blue"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={onCancel}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={disabled || !croppedAreaPixels}
              onClick={() => void handleConfirm()}
              className="rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-blue/25 hover:bg-brand-blue-dark disabled:opacity-50"
            >
              {busy || preparing ? "Saving…" : "Use photo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
