import Image from "next/image";
import { PRODUCT_DESCRIPTOR, PRODUCT_NAME } from "@/lib/brand-kit";

/** The Weaver mark, from the kit's own file (public/brand/weaver-mark.svg). Never recolour, outline or redraw it. */
export function WeaverMark({ size = 44, className }: { size?: number; className?: string }) {
  return <Image src="/brand/weaver-mark.svg" alt="" width={size} height={size} unoptimized className={className} />;
}

/**
 * The Weaver lockup (brand/components/Logo): the mark, the name and the descriptor.
 * `default` sits on canvas or white; `light` sits on navy, with the mark on a white tile.
 * Inside an organization's space the organization's own name and logo lead and this appears small, at the foot.
 */
export function WeaverLogo({ setting = "default" }: { setting?: "default" | "light" }) {
  const light = setting === "light";
  return (
    <span className="flex items-center gap-1.5">
      {light ? (
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-logo-tile bg-white">
          <WeaverMark size={32} />
        </span>
      ) : (
        <WeaverMark size={44} className="flex-none" />
      )}
      <span className="flex flex-col">
        <span className={`font-display text-wordmark ${light ? "text-white" : "text-navy"}`}>{PRODUCT_NAME}</span>
        <span className={`mt-1 text-descriptor ${light ? "text-navy-200" : "text-muted"}`}>{PRODUCT_DESCRIPTOR}</span>
      </span>
    </span>
  );
}
