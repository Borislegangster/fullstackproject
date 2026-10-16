"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

import { api } from "@/lib/api";

export function HelpFeedback({ slug }: { slug: string }) {
  const [sent, setSent] = useState(false);
  const send = async (helpful: boolean) => {
    try {
      await api(`/public/help/${encodeURIComponent(slug)}/feedback`, { method: "POST", body: { helpful } });
    } finally {
      setSent(true);
    }
  };
  return (
    <div className="rounded-2xl bg-surface p-5 text-center">
      {sent ? (
        <p className="text-sm text-emerald-700">Merci pour votre retour !</p>
      ) : (
        <>
          <p className="text-sm font-medium text-ink">Cet article vous a-t-il été utile ?</p>
          <div className="mt-3 flex justify-center gap-3">
            <button type="button" onClick={() => void send(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm ring-1 ring-line hover:bg-emerald-50">
              <ThumbsUp className="h-4 w-4" /> Oui
            </button>
            <button type="button" onClick={() => void send(false)} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm ring-1 ring-line hover:bg-red-50">
              <ThumbsDown className="h-4 w-4" /> Non
            </button>
          </div>
        </>
      )}
    </div>
  );
}
