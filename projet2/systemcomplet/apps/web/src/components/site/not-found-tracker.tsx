"use client";

import { useEffect } from "react";

import { track } from "@/lib/tracker";

export function NotFoundTracker() {
  useEffect(() => {
    track({ type: "not_found", path: window.location.pathname });
  }, []);
  return null;
}
