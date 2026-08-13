"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useAuth, useClerk, useUser } from "@clerk/nextjs";

import { toast } from "sonner";

import { setAuthToken, useUpdateAvatar } from "@repo/api-client";
import { reportError, safeClerkCall } from "@repo/utils";

import { AdminAvatarCropDialog } from "./admin-avatar-crop-dialog";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function AdminAccountBox() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { openUserProfile } = useClerk();
  const uploadAvatar = useUpdateAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.primaryEmailAddress?.emailAddress ||
    "Administrator";
  const email = user?.primaryEmailAddress?.emailAddress ?? "Admin session active";
  const imageUrl = user?.imageUrl;
  const hasCustomImage = Boolean(user?.hasImage);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !cropSrc) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, cropSrc]);

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  function clearCropPreview() {
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFilePicked(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be 8MB or smaller");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  async function handleCroppedAvatar(file: File) {
    if (!user) return;

    setUploading(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      const clerkResult = await safeClerkCall(() => user.setProfileImage({ file }));
      if (clerkResult && typeof clerkResult === "object" && "error" in clerkResult) {
        throw clerkResult.error;
      }
      await uploadAvatar.mutateAsync(file);
      await user.reload();
      clearCropPreview();
      toast.success("Avatar updated");
    } catch (error) {
      reportError(error, { action: "admin-avatar-upload" });
      toast.error("Could not update avatar");
    } finally {
      setUploading(false);
    }
  }

  function openClerkProfile() {
    setOpen(false);
    openUserProfile();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!isLoaded}
        className="flex w-full items-center gap-3 rounded-2xl border border-brand-night-border bg-brand-night-elevated px-3 py-3 text-left transition hover:bg-brand-night-border/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan disabled:opacity-60"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-blue/40 ring-2 ring-brand-cyan/50">
          {imageUrl ? (
            // Clerk CDN; plain img avoids Next image domain config for session photos.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-semibold text-white">
              {initialsFromName(displayName)}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{displayName}</span>
          <span className="block truncate text-xs text-slate-400">{email}</span>
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-brand-night/70 backdrop-blur-sm"
            aria-label="Close account dialog"
            onClick={() => {
              if (!cropSrc) setOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-brand-night/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                  Admin account
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Update your photo or open full account settings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-6 flex flex-col items-center text-center">
              <div className="relative">
                <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-brand-mist ring-4 ring-brand-blue/15">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={`${displayName} avatar`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-semibold text-brand-blue-dark">
                      {initialsFromName(displayName)}
                    </span>
                  )}
                </span>
              </div>
              <p className="mt-3 text-base font-semibold text-slate-900">{displayName}</p>
              <p className="text-sm text-slate-500">{email}</p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  handleFilePicked(event.target.files?.[0]);
                }}
              />

              <button
                type="button"
                disabled={uploading || !user}
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-blue/25 hover:bg-brand-blue-dark disabled:opacity-50"
              >
                {uploading
                  ? "Uploading…"
                  : hasCustomImage
                    ? "Change avatar"
                    : "Add avatar"}
              </button>

              <button
                type="button"
                onClick={openClerkProfile}
                className="mt-2 rounded-xl px-4 py-2 text-sm font-semibold text-brand-blue-dark hover:bg-brand-mist"
              >
                Manage account
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminAvatarCropDialog
        open={Boolean(cropSrc)}
        imageSrc={cropSrc ?? ""}
        busy={uploading}
        onCancel={clearCropPreview}
        onConfirm={handleCroppedAvatar}
      />
    </>
  );
}
