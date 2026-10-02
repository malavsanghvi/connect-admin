"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * The flyer image on the Details tab. The server can sign the link correctly and the image can
 * still fail in the browser: the signed link expires (a page restored from history reuses the old
 * one), or a saved https link points at a file or host that is gone. Neither reaches the server, so
 * this swaps the broken image for the problem in plain English and a Try again that reloads the
 * page data (re-signing the link) and asks for the image again.
 */
export function FlyerImage({
  src,
  alt,
  signedMinutes,
  failedMessage,
}: {
  src: string;
  alt: string;
  /** Set when `src` is a signed link: how long it works, for the note under the image. */
  signedMinutes: number | null;
  /** What to show when the image does not load. */
  failedMessage: string;
}) {
  const router = useRouter();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, startTransition] = useTransition();

  if (failedSrc === src) {
    return (
      <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
        <p>{failedMessage}</p>
        <div className="mt-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pending}
            onClick={() =>
              // One transition: the error stays up until the refreshed page (with a newly signed
              // link) arrives, then the image is mounted again so the browser asks for it afresh.
              startTransition(() => {
                setFailedSrc(null);
                setAttempt((n) => n + 1);
                router.refresh();
              })
            }
          >
            {pending ? "Trying again…" : "Try again"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={attempt}
        src={src}
        alt={alt}
        onError={() => setFailedSrc(src)}
        // The image is in the server-rendered HTML, so it can fail before React attaches onError.
        // A finished image with no width is a broken one.
        ref={(img) => {
          if (img?.complete && img.naturalWidth === 0) setFailedSrc(src);
        }}
        className="w-full rounded-lg border border-line"
      />
      {signedMinutes !== null && (
        <p className="mt-2 text-xs text-muted">This preview link works for {signedMinutes} minutes. If the image stops showing, reload the page.</p>
      )}
    </>
  );
}
