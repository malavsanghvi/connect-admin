import type { TenantBranding } from "@/lib/brand";

/**
 * The community's logo from its brand kit (never a hard-coded one), on a white tile so a dark logo
 * stays readable on the navy header. A community without a logo gets its initials.
 */
export function TenantMark({ branding, name, size = 36 }: { branding: TenantBranding; name: string; size?: number }) {
  if (branding.logoUrl) {
    return (
      <span className="inline-flex shrink-0 items-center justify-center rounded-[10px] bg-white p-1" style={{ height: size, minWidth: size }}>
        {/* A community-configured https URL on any host: next/image would need every host allow-listed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={branding.logoUrl} alt={`${name} logo`} style={{ height: size - 8, width: "auto", maxWidth: size * 3 }} />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={`${name} logo`}
      style={{ height: size, minWidth: size, fontSize: Math.round(size * (branding.monogram.length > 2 ? 0.3 : 0.38)) }}
      className="inline-flex shrink-0 items-center justify-center rounded-[10px] border border-white/30 px-1 font-extrabold tracking-wide text-white"
    >
      {branding.monogram}
    </span>
  );
}
