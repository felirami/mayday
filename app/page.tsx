import { Console } from "@/components/Console";
import { hasCerebrasKey } from "@/lib/cerebras";
import { baselineLabel } from "@/lib/race";

export const dynamic = "force-dynamic";

export default function Page() {
  return <Console hasKey={hasCerebrasKey()} baselineLabel={baselineLabel()} />;
}
