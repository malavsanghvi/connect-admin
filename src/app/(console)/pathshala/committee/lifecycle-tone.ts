import type { Tone } from "@/components/ui";
import type { Lifecycle } from "@/lib/logic/resolutions";

export const LIFECYCLE_TONE: Record<Lifecycle, Tone> = {
  Draft: "muted",
  "Comment period open": "navy",
  "Comment period paused": "warning",
  "Ready for vote": "purple",
  "Voting open": "maroon",
  "Voting paused": "warning",
  "Closed – passed": "success",
  "Closed – failed": "danger",
  "Closed – no quorum": "neutral",
  Withdrawn: "muted",
};
