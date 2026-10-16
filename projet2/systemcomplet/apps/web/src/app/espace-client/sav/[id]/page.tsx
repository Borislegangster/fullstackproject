"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { TicketDetail } from "@/components/support/ticket-detail";

export default function ClientTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="space-y-4">
      <Link href="/espace-client/sav" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Mes demandes
      </Link>
      <TicketDetail ticketId={id} />
    </div>
  );
}
