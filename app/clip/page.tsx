import { VerticalDemo } from "@/components/VerticalDemo";
import { hasCerebrasKey } from "@/lib/cerebras";
import { baselineLabel } from "@/lib/race";

export const dynamic = "force-dynamic";

// Portrait (9:16) auto-running demo reel for an X / mobile clip.
// /clip?scenario=db-pool  ·  add ?auto=0 to disable auto-run.
export default function ClipPage() {
  return <VerticalDemo hasKey={hasCerebrasKey()} baselineLabel={baselineLabel()} />;
}
