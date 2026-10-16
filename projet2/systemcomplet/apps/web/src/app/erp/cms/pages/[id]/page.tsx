"use client";

import { use } from "react";

import { PageEditor } from "@/components/cms/page-editor";

export default function CmsPageEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PageEditor pageId={id === "nouvelle" ? null : id} />;
}
