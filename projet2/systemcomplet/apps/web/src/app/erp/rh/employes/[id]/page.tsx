"use client";

import { use } from "react";

import { EmployeeDetail } from "@/components/erp/hr";

export default function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <EmployeeDetail id={id} />;
}
