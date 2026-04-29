"use client";
import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const CURRENT_MONTH = new Date().getMonth();
const CURRENT_YEAR  = new Date().getFullYear();

export function useMonthNav() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const viewMonth = parseInt(searchParams.get("month") ?? String(CURRENT_MONTH));
  const viewYear  = parseInt(searchParams.get("year")  ?? String(CURRENT_YEAR));

  const navigate = useCallback(
    (month: number, year: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("month", String(month));
      params.set("year",  String(year));
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  function goToPrevMonth() {
    if (viewMonth === 0) navigate(11, viewYear - 1);
    else navigate(viewMonth - 1, viewYear);
  }

  function goToNextMonth() {
    if (viewMonth === 11) navigate(0, viewYear + 1);
    else navigate(viewMonth + 1, viewYear);
  }

  function goToMonth(month: number) {
    navigate(month, viewYear);
  }

  return { viewMonth, viewYear, goToPrevMonth, goToNextMonth, goToMonth };
}
