"use client";

import { FinancingSimulator } from "@/components/innovations/financing-simulator";

export function FinancingPublic() {
  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-8">
      <FinancingSimulator />
    </div>
  );
}
