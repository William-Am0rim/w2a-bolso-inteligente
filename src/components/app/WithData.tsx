import type { ReactNode } from "react";
import { useFinance, type FinanceData } from "@/lib/data";
import { ErrorState, LoadingState } from "./kit";

export function WithData({ children }: { children: (d: FinanceData) => ReactNode }) {
  const q = useFinance();
  if (q.isLoading) return <LoadingState />;
  if (q.error || !q.data) return <ErrorState message="Não foi possível carregar seus dados." onRetry={() => q.refetch()} />;
  return <>{children(q.data)}</>;
}

export function MonthPicker({ value, onChange, id = "month" }: { value: string; onChange: (m: string) => void; id?: string }) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted-foreground">Mês</label>
      <input id={id} type="month" value={value.slice(0, 7)} onChange={(e) => e.target.value && onChange(e.target.value + "-01")}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    </div>
  );
}
