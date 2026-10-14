import { ICON_MARKUP, type IconName } from "@/components/brand-icons.generated";

export type { IconName };

/**
 * The Weaver icon set (brand/icons/*.svg: 24px grid, stroke 2, round caps and joins, no fill), drawn in the colour of the text around
 * it. The shapes are generated from the kit's own files (pnpm brand:sync). Icons are decorative: the words beside them carry the meaning.
 */
export function Icon({ name, className = "h-5 w-5", strokeWidth = 2 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      // The markup is generated from this repository's own brand/icons files, never from user input.
      dangerouslySetInnerHTML={{ __html: ICON_MARKUP[name] }}
    />
  );
}
