"use client";

import { ClientReview } from "./client-review";
import { WithProject } from "@/components/client/client-project";

export default function ClientReviewPage() {
  return <WithProject>{(p) => <ClientReview projectId={p.id} projectName={p.name} />}</WithProject>;
}
