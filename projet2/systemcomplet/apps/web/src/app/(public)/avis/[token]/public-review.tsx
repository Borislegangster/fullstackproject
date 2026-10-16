"use client";

import { ReviewForm } from "@/components/innovations/review-form";
import { api } from "@/lib/api";

export function PublicReview({ token, firstName, projectName }: { token: string; firstName: string; projectName: string }) {
  return (
    <ReviewForm
      firstName={firstName}
      projectName={projectName}
      submit={async (form) => {
        await api(`/public/reviews/${encodeURIComponent(token)}`, { method: "POST", form });
      }}
    />
  );
}
