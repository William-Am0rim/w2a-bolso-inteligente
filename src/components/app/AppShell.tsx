import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, ArrowLeftRight, Landmark, CreditCard, PieChart, Target, BarChart3, Tags, Settings,
  Menu, Plus, LogOut, Moon, Sun, LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/prefs";
import { generateRecurrences, useFinance, useRefresh, type Tx } from "@/lib/data";
import logoAsset from "@/assets/sr-strix-logo.png.asset.json";
import { TransactionDialog, type TxDialogInit } from "./TransactionDialog";

const NAV = [
  { to: "/finance/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/finance/transactions", label: "Lançamentos", icon: ArrowLeftRight },
  { to: "/finance/accounts", label: "Contas", icon: Landmark },
  { to: "/finance/cards", label: "Cartões", icon: CreditCard },
  { to: "/finance/budgets", label: "Orçamentos", icon: PieChart },
  { to: "/finance/goals", label: "Metas", icon: Target },
  { to: "/finance/reports", label: "Relatórios", icon: BarChart3 },
  { to: "/finance/categories", label: "Categorias", icon: Tags },
  { to: "/finance/settings", label: "Configurações", icon: Settings },
] as const;

const TxCtx = createContext<{ openTx: (init?: TxDialogInit) => void; editTx: (tx: Tx) => void }>({ openTx: () => {}, editTx: () => {} });
export const useTxDialog = () => useContext(TxCtx);

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-1">
      {NAV.map((n) => {
        const active = path.startsWith(n.to);
        return (
          <Link key={n.to} to={n.to} onClick={onNavigate} aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}>
            <n.icon className="h-4 w-4" aria-hidden />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <img src={logoAsset.url} alt="Sr. Strix Finanças" className="h-20 w-40 object-contain" />
    </div>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [txInit, setTxInit] = useState<TxDialogInit>({});
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useFinance();
  const refresh = useRefresh();
  const ran = useRef(false);

  useEffect(() => {
    if (!data || ran.current || !data.profile) return;
    ran.current = true;
    generateRecurrences(data.recurrences, data.profile.id)
      .then((n) => { if (n) refresh(); })
      .catch((e) => toast.error("Falha ao gerar recorrências: " + e.message));
  }, [data, refresh]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { redirect: "" }, replace: true });
  }

  const ctx = {
    openTx: (init: TxDialogInit = {}) => { setTxInit(init); setTxOpen(true); },
    editTx: (tx: Tx) => { setTxInit({ tx }); setTxOpen(true); },
  };

  const footer = (
    <div className="mt-auto flex flex-col gap-1 border-t border-sidebar-border pt-3">
      <Link to="/portal" preload="intent" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
        <LayoutGrid className="h-4 w-4" aria-hidden /> Voltar ao portal
      </Link>
      <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
        {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
        {theme === "dark" ? "Tema claro" : "Tema escuro"}
      </button>
      <button onClick={signOut} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
        <LogOut className="h-4 w-4" aria-hidden /> Sair
      </button>
    </div>
  );

  return (
    <TxCtx.Provider value={ctx}>
      <div className="min-h-screen bg-background">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 bg-sidebar p-4 lg:flex">
          <Brand />
          <NavList />
          {footer}
        </aside>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="flex w-72 flex-col gap-6 border-sidebar-border bg-sidebar p-4">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">Navegação principal</SheetDescription>
            <Brand />
            <NavList onNavigate={() => setMobileOpen(false)} />
            {footer}
          </SheetContent>
        </Sheet>
        <div className="lg:pl-64">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur sm:px-6">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <span className="font-semibold lg:hidden">Sr. Strix</span>
            <div className="ml-auto">
              <Button onClick={() => ctx.openTx()}><Plus className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Novo lançamento</span><span className="sm:hidden">Novo</span></Button>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl p-3 sm:p-6">
            <Outlet />
          </main>
        </div>
        <TransactionDialog open={txOpen} onOpenChange={setTxOpen} init={txInit} />
      </div>
    </TxCtx.Provider>
  );
}
