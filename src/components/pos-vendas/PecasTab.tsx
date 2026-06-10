import { PecasTemplatesSection } from "./PecasTemplatesSection";
import { PecasLojasSection } from "./PecasLojasSection";

export function PecasTab() {
  return (
    <div className="space-y-8">
      <PecasTemplatesSection />
      <PecasLojasSection />
    </div>
  );
}