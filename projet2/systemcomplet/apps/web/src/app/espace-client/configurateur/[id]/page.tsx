"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { ConfiguratorView } from "@/components/configurator/configurator-view";

export default function ClientConfiguratorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="space-y-4">
      <Link href="/espace-client/configurateur" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Configurations
      </Link>
      <ConfiguratorView modelId={id} validationsHref="/espace-client/validations" />
    </div>
  );
}
