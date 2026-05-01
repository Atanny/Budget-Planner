"use client";
export const dynamic = "force-dynamic";
import CreditPayModal from "@/components/dashboard/CreditPayModal";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BudgetItem, UserSettings, SalaryHistory, BankAccount, Cutoff } from "@/lib/types";
import HeroBanner      from "@/components/dashboard/HeroBanner";
import AccountCards    from "@/components/dashboard/AccountCards";
import PaymentList, { CreditRecord } from "@/components/dashboard/PaymentList";
import SahodModal      from "@/components/dashboard/SahodModal";
import TransferModal   from "@/components/dashboard/TransferModal";
import BankFormModal   from "@/components/dashboard/BankFormModal";
import PayConfirmModal from "@/components/dashboard/PayConfirmModal";
import MonthNav        from "@/components/shared/MonthNav";
import ConfirmModal    from "@/components/ConfirmModal";
import { useMonthNav } from "@/hooks/useMonthNav";
import { formatCurrency } from "@/lib/utils";
import { X, CreditCard, Eye, Home as HomeIcon, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getLoanMonthScope(item: BudgetItem, year: number) {
  if (!item.is_loan) return null;
  const ld = (item as any).loan_details?.[0] ?? (item as any).loan_details;
  if (!ld?.start_date || !ld?.total_months) return null;
  const totalM = parseInt(ld.total_months);
  const loanStart = new Date(ld.start_date);
  if (totalM >= 9999) {
    if (loanStart.getFullYear() > year) return null;
    return { start: loanStart.getFullYear() < year ? 0 : loanStart.getMonth(), end: 11 };
  }
  const loanEnd = new Date(loanStart);
  loanEnd.setMonth(loanEnd.getMonth() + totalM - 1);
  if (loanStart.getFullYear() > year || loanEnd.getFullYear() < year) return null;
  return {
    start: loanStart.getFullYear() < year ? 0 : loanStart.getMonth(),
    end:   loanEnd.getFullYear()   > year ? 11 : loanEnd.getMonth(),
  };
}

function isItemVisible(item: BudgetItem, month: number, year: number): boolean {
  if (item.is_loan) {
    const s = getLoanMonthScope(item, year);
    return !!(s && month >= s.start && month <= s.end);
  }
  if (!item.created_at) return true;
  const created = new Date(item.created_at);
  if (item.status === "Once") return created.getFullYear() === year && created.getMonth() === month;
  if (year < created.getFullYear()) return false;
  if (year === created.getFullYear() && month < created.getMonth()) return false;
  return true;
}

type PaymentState = Record<string, Record<number, { paid: boolean; receipt_url?: string }>>;

function DashboardPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { viewMonth, viewYear, goToPrevMonth, goToNextMonth, goToMonth } = useMonthNav();

  const [settings,      setSettings]      = useState<UserSettings | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistory | null>(null);
  const [items,         setItems]         = useState<BudgetItem[]>([]);
  const [payments,      setPayments]      = useState<PaymentState>({});
  const [banks,         setBanks]         = useState<BankAccount[]>([]);
  const [creditRecords, setCreditRecords] = useState<CreditRecord[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [userId,        setUserId]        = useState<string | null>(null);
  const [userName,      setUserName]      = useState("User");
  const [netHidden,     setNetHidden]     = useState(false);
  const [activeTab,     setActiveTab]     = useState<Cutoff>("1st");
  const [showSahod,     setShowSahod]     = useState(false);
  const [showTransfer,  setShowTransfer]  = useState(false);
  const [transferFromId,setTransferFromId]= useState("");
  const [showBankForm,  setShowBankForm]  = useState(false);
  const [editBank,      setEditBank]      = useState<BankAccount | null>(null);
  const [confirmBankOpen,setConfirmBankOpen] = useState(false);
  const [confirmBankId, setConfirmBankId] = useState<string | null>(null);
  const [confirmBankName,setConfirmBankName] = useState("");
  const [payConfirmItem,setPayConfirmItem]= useState<BudgetItem | null>(null);
  const [savingsCheck1st,setSavingsCheck1st] = useState(false);
  const [savingsCheck2nd,setSavingsCheck2nd] = useState(false);
  const [dashReceiptItem,setDashReceiptItem] = useState<BudgetItem | null>(null);
  const [dashCreditPayId,setDashCreditPayId] = useState<string | null>(null);
  const [dashCreditPayRowType,setDashCreditPayRowType] = useState<"used"|"due"|null>(null);
  const [dashCreditViewId,setDashCreditViewId] = useState<string | null>(null);
  const [dashCreditViewRowType,setDashCreditViewRowType] = useState<"used"|"due"|null>(null);
  const [dashCreditReceiptUrl,setDashCreditReceiptUrl] = useState<string | null>(null);

  useEffect(() => {
    try { if (localStorage.getItem("netHidden") === "true") setNetHidden(true); } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const meta = user.user_metadata as Record<string, string> | undefined;
    setUserName(meta?.full_name || meta?.name || user.email?.split("@")[0] || "User");

    const [settRes, itemRes, payRes, bankRes, salHistRes, creditRes] = await Promise.all([
      supabase.from("user_settings").select("*").eq("user_id", user.id).single(),
      supabase.from("budget_items").select("*, loan_details(*)").eq("user_id", user.id).eq("is_active", true),
      supabase.from("monthly_payments").select("*").eq("user_id", user.id).eq("year", viewYear),
      supabase.from("bank_accounts").select("*").eq("user_id", user.id).eq("is_active", true).order("sort_order"),
      supabase.from("salary_history").select("*").eq("user_id", user.id).eq("year", viewYear).eq("month", viewMonth + 1).maybeSingle(),
      supabase.from("credit_records").select("*").eq("user_id", user.id),
    ]);

    setSettings(settRes.data);
    setSalaryHistory(salHistRes.data ?? null);
    setItems(itemRes.data || []);
    setCreditRecords(creditRes.data || []);

    let banksList = bankRes.data || [];
    const hasCash = banksList.some((b: BankAccount) => b.type === "cash" && b.name === "Cash");
    if (!hasCash) {
      const { data: cashAcct } = await supabase.from("bank_accounts").insert({
        user_id: user.id, name: "Cash", type: "cash", balance: 0, color: "#16a34a",
        category: "Cash", is_active: true, sort_order: 0, is_main_bank: false, is_required: true,
      }).select().single();
      if (cashAcct) banksList = [cashAcct, ...banksList];
    }
    setBanks(banksList);

    const map: PaymentState = {};
    for (const p of (payRes.data || [])) {
      if (!map[p.budget_item_id]) map[p.budget_item_id] = {};
      map[p.budget_item_id][p.month] = { paid: p.paid, receipt_url: p.receipt_url };
    }
    setPayments(map);

    const savGoal = settRes.data?.savings_goal || 0;
    if (savGoal) {
      const { data: savData } = await supabase.from("monthly_savings").select("*").eq("user_id", user.id).eq("year", viewYear).eq("month", viewMonth + 1).maybeSingle();
      setSavingsCheck1st((savData?.kinsenas || 0) >= savGoal);
      setSavingsCheck2nd((savData?.atrenta  || 0) >= savGoal);
    } else {
      setSavingsCheck1st(false);
      setSavingsCheck2nd(false);
    }
    setLoading(false);
  }, [viewYear, viewMonth]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get("action") === "sahod")    { setShowSahod(true);    router.replace("/"); }
    if (searchParams.get("action") === "transfer") { setShowTransfer(true); router.replace("/"); }
  }, [searchParams, router]);

  async function confirmCreditPaid(params: { creditId: string; rowType: "used"|"due"; bankId: string; receiptFile: File|null; transferFee: number }) {
    if (!userId) return;
    const { creditId, rowType, bankId, receiptFile, transferFee } = params;
    let receiptUrl: string | null = null;
    if (receiptFile) {
      const ext = receiptFile.name.split(".").pop();
      const path = `credit-receipts/${userId}/${rowType}/${creditId}/${Date.now()}.${ext}`;
      const { data: up, error: upErr } = await supabase.storage.from("receipts").upload(path, receiptFile);
      if (!upErr && up) {
        const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
        receiptUrl = urlData.publicUrl;
      }
    }
    const credit = creditRecords.find(c => c.id === creditId);
    if (!credit) return;
    const totalAmount = credit.amount + transferFee;
    const updateData = rowType === "used"
      ? { used_status: "Paid" as const, used_receipt_url: receiptUrl, used_paid_at: new Date().toISOString(), used_payment_bank_id: bankId || null, used_transfer_fee: transferFee }
      : { due_status:  "Paid" as const, due_receipt_url:  receiptUrl, due_paid_at:  new Date().toISOString(), due_payment_bank_id:  bankId || null, due_transfer_fee:  transferFee };
    await supabase.from("credit_records").update(updateData).eq("id", creditId);
    if (bankId) {
      await supabase.rpc("adjust_bank_balance", { p_id: bankId, p_delta: -totalAmount });
      const { data: updatedBanks } = await supabase.from("bank_accounts").select("*").eq("user_id", userId).eq("is_active", true);
      if (updatedBanks) setBanks(updatedBanks);
    }
    setCreditRecords(prev => prev.map(c => {
      if (c.id !== creditId) return c;
      if (rowType === "used") return { ...c, used_status: "Paid" as const, used_receipt_url: receiptUrl, used_payment_bank_id: bankId || null, used_transfer_fee: transferFee };
      return { ...c, due_status: "Paid" as const, due_receipt_url: receiptUrl, due_payment_bank_id: bankId || null, due_transfer_fee: transferFee };
    }));
    setDashCreditPayId(null); setDashCreditPayRowType(null);
  }

  async function handleSavingsToggle() {
    if (!userId) return;
    const is1st = activeTab === "1st";
    const next  = !(is1st ? savingsCheck1st : savingsCheck2nd);
    if (is1st) setSavingsCheck1st(next); else setSavingsCheck2nd(next);
    await supabase.from("monthly_savings").upsert({
      user_id: userId, year: viewYear, month: viewMonth + 1,
      [is1st ? "kinsenas" : "atrenta"]: next ? (settings?.savings_goal || 0) : 0,
    }, { onConflict: "user_id,year,month" });
  }

  async function handleTogglePayment(item: BudgetItem, bankId: string, totalAmount: number, receiptFile: File | null) {
    if (!userId) return;
    const month = viewMonth + 1;
    let receiptUrl: string | undefined;
    if (receiptFile) {
      const ext = receiptFile.name.split(".").pop();
      const path = `receipts/${userId}/${item.id}/${viewYear}-${month}.${ext}`;
      const { data: up, error: upErr } = await supabase.storage.from("receipts").upload(path, receiptFile, { upsert: true });
      if (!upErr && up) {
        const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
        receiptUrl = urlData.publicUrl;
      }
    }

    // Check if a record already exists for this item/year/month
    const { data: existing } = await supabase
      .from("monthly_payments")
      .select("id")
      .eq("budget_item_id", item.id)
      .eq("user_id", userId)
      .eq("year", viewYear)
      .eq("month", month)
      .maybeSingle();

    const payload = {
      budget_item_id: item.id,
      user_id: userId,
      year: viewYear,
      month,
      paid: true,
      paid_at: new Date().toISOString(),
      ...(receiptUrl ? { receipt_url: receiptUrl } : {}),
    };

    let dbError;
    if (existing?.id) {
      // Update existing row
      const { error } = await supabase
        .from("monthly_payments")
        .update({ paid: true, paid_at: payload.paid_at, ...(receiptUrl ? { receipt_url: receiptUrl } : {}) })
        .eq("id", existing.id);
      dbError = error;
    } else {
      // Insert new row
      const { error } = await supabase.from("monthly_payments").insert(payload);
      dbError = error;
    }

    if (dbError) throw new Error(dbError.message);

    if (bankId) {
      await supabase.rpc("adjust_bank_balance", { p_id: bankId, p_delta: -totalAmount });
      const { data: updatedBanks } = await supabase.from("bank_accounts").select("*").eq("user_id", userId).eq("is_active", true);
      if (updatedBanks) setBanks(updatedBanks);
    }
    setPayments(prev => ({ ...prev, [item.id]: { ...prev[item.id], [month]: { paid: true, receipt_url: receiptUrl ?? prev[item.id]?.[month]?.receipt_url } } }));
    setPayConfirmItem(null);
  }

  async function handleSahod(params: { amount: number; extra: number; cutoff: "1st"|"2nd"; bankId: string }) {
    if (!userId) return;
    const { amount, extra, cutoff, bankId } = params;
    const total = amount + extra;
    const targetBank = banks.find(b => b.id === bankId) || banks.find(b => b.is_main_bank);
    if (targetBank) {
      const newBal = targetBank.balance + total;
      await supabase.from("bank_accounts").update({ balance: newBal }).eq("id", targetBank.id);
      setBanks(prev => prev.map(b => b.id === targetBank.id ? { ...b, balance: newBal } : b));
    }
    if (targetBank?.is_main_bank) {
      const prevTotal   = settings?.total_salary_received || 0;
      const salaryField = cutoff === "1st" ? "first_cutoff_salary" : "second_cutoff_salary";
      const extraField  = cutoff === "1st" ? "extra_income_1st"    : "extra_income_2nd";
      const { data: existing } = await supabase.from("salary_history").select("*").eq("user_id", userId).eq("year", viewYear).eq("month", viewMonth + 1).maybeSingle();
      const payload = {
        user_id: userId, year: viewYear, month: viewMonth + 1,
        first_cutoff_salary:  salaryField === "first_cutoff_salary"  ? amount : (existing?.first_cutoff_salary  ?? settings?.first_cutoff_salary  ?? 0),
        second_cutoff_salary: salaryField === "second_cutoff_salary" ? amount : (existing?.second_cutoff_salary ?? settings?.second_cutoff_salary ?? 0),
        extra_income_1st:     extraField  === "extra_income_1st"     ? extra  : (existing?.extra_income_1st     ?? settings?.extra_income_1st     ?? 0),
        extra_income_2nd:     extraField  === "extra_income_2nd"     ? extra  : (existing?.extra_income_2nd     ?? settings?.extra_income_2nd     ?? 0),
        savings_goal: existing?.savings_goal ?? settings?.savings_goal ?? 500,
      };
      const { data: histData } = await supabase.from("salary_history").upsert(payload, { onConflict: "user_id,year,month" }).select().single();
      await supabase.from("user_settings").update({ total_salary_received: prevTotal + total }).eq("user_id", userId);
      setSalaryHistory(histData ?? null);
      setSettings(prev => prev ? { ...prev, total_salary_received: prevTotal + total } : prev);
    }
    setShowSahod(false);
  }

  async function handleTransfer(params: { fromId: string; toId: string; amount: number; note: string; transferFee: number }) {
    if (!userId) return;
    const { fromId, toId, amount, note, transferFee } = params;
    const from = banks.find(b => b.id === fromId)!;
    const to   = banks.find(b => b.id === toId)!;
    const totalDeducted = amount + transferFee;
    const newFrom = from.balance - totalDeducted, newTo = to.balance + amount;
    await Promise.all([
      supabase.from("bank_accounts").update({ balance: newFrom }).eq("id", fromId),
      supabase.from("bank_accounts").update({ balance: newTo   }).eq("id", toId),
    ]);
    setBanks(prev => prev.map(b => b.id === fromId ? { ...b, balance: newFrom } : b.id === toId ? { ...b, balance: newTo } : b));
    const feeNote = transferFee > 0 ? ` (fee: ${formatCurrency(transferFee)})` : "";
    await supabase.from("transaction_logs").insert({ user_id: userId, action: "add", item_name: `Transfer: ${from.name} → ${to.name}`, amount, category: "Transfer", notes: (note || "") + feeNote || null, created_at: new Date().toISOString() });
    setShowTransfer(false); setTransferFromId("");
  }

  async function handleSaveBank(data: any) {
    if (!userId) return;
    if (data.is_main_bank) {
      await supabase.from("bank_accounts").update({ is_main_bank: false }).eq("user_id", userId);
      setBanks(prev => prev.map(b => ({ ...b, is_main_bank: false })));
    }
    const payload = data.is_credit ? { ...data, credit_limit: data.balance } : data;
    if (editBank) {
      const { data: updated } = await supabase.from("bank_accounts").update(payload).eq("id", editBank.id).select().single();
      if (updated) setBanks(prev => prev.map(b => b.id === editBank.id ? updated : b));
    } else {
      const { data: created } = await supabase.from("bank_accounts").insert({ ...payload, user_id: userId }).select().single();
      if (created) setBanks(prev => [...prev, created]);
    }
    setShowBankForm(false); setEditBank(null);
  }

  function askDeleteBank(id: string, name: string) {
    const bank = banks.find(b => b.id === id);
    if (bank?.is_required || bank?.name === "Cash") { alert("The Cash account is required and cannot be deleted."); return; }
    setConfirmBankId(id); setConfirmBankName(name); setConfirmBankOpen(true);
  }

  async function doDeleteBank() {
    if (!confirmBankId) return;
    await supabase.from("bank_accounts").update({ is_active: false }).eq("id", confirmBankId);
    setBanks(prev => prev.filter(b => b.id !== confirmBankId));
    setConfirmBankOpen(false); setConfirmBankId(null);
  }

  // ── Derived ─────────────────────────────────────
  const activeSalary = salaryHistory ?? settings;
  const netWorth     = (activeSalary?.first_cutoff_salary || 0) + (activeSalary?.second_cutoff_salary || 0);

  const cutoffItems = items.filter(
  (i: any) =>
    (i.cutoff === activeTab || i.cutoff === "both") &&
    i.status !== "Suspended" &&
    isItemVisible(i, viewMonth, viewYear)
);
  const creditRows: { credit: CreditRecord; rowType: "used"|"due" }[] = [];
  for (const c of creditRecords) {
    if (c.date_taken) {
      const d = new Date(c.date_taken + "T00:00:00");
      const cut: Cutoff = d.getDate() <= 15 ? "1st" : "2nd";
      if (cut === activeTab && d.getMonth() === viewMonth && d.getFullYear() === viewYear)
        creditRows.push({ credit: c, rowType: "used" });
    }
    if (c.due_date) {
      const d = new Date((c.due_date as string) + "T00:00:00");
      const cut: Cutoff = d.getDate() <= 15 ? "1st" : "2nd";
      if (cut === activeTab && d.getMonth() === viewMonth && d.getFullYear() === viewYear)
        creditRows.push({ credit: c, rowType: "due" });
    }
  }

  const salary        = activeTab === "1st" ? (activeSalary?.first_cutoff_salary || 0) : (activeSalary?.second_cutoff_salary || 0);
  const extraIncome   = activeTab === "1st" ? (activeSalary?.extra_income_1st    || 0) : (activeSalary?.extra_income_2nd    || 0);
  const totalIncome   = salary + extraIncome;
  const savingsChecked = activeTab === "1st" ? savingsCheck1st : savingsCheck2nd;
  const savingsGoal   = activeSalary?.savings_goal || 0;

  if (loading) return (
    <div style={{ display: "grid", placeItems: "center", height: 256 }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div style={{ width: "100%", paddingBottom: 24 }}>

      {/* ── Page Header (matching Figma) ── */}
      <div className="page-header">
        <div className="page-header-icon">
          <HomeIcon size={22} color="white" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="page-header-title">HOME</h1>
          <p className="page-header-subtitle">View All List of Payments per Cutoff.</p>
        </div>
      </div>

      {/* ── Hero Banner ── */}
      <HeroBanner
        userName={userName}
        netWorth={netWorth}
        netHidden={netHidden}
        onToggleHidden={() => {
          const v = !netHidden; setNetHidden(v);
          try { localStorage.setItem("netHidden", String(v)); } catch {}
        }}
        onSahodClick={() => setShowSahod(true)}
      />

      {/* ── Account Cards ── */}
      <AccountCards
        banks={banks}
        onAddAccount={() => { setEditBank(null); setShowBankForm(true); }}
        onEditAccount={bank => { setEditBank(bank); setShowBankForm(true); }}
        onDeleteAccount={askDeleteBank}
        onTransfer={fromId => { setTransferFromId(fromId); setShowTransfer(true); }}
      />

      {/* ── Payment List Header + CutoffTabs + MonthNav ── */}
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, fontFamily: "Nunito, sans-serif", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 12px" }}>
          Payment List -{" "}
          <span style={{ color: "var(--primary)" }}>
            {activeTab === "1st" ? "1st" : "2nd"} {MONTHS_LONG[viewMonth]}
          </span>
        </h2>
        {/* Cutoff tabs + month nav on same row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {(["1st", "2nd"] as Cutoff[]).map(tab => {
              const active = activeTab === tab;
              return (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: "9px 20px", borderRadius: 10, fontFamily: "Nunito, sans-serif",
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                  border: `1.5px solid ${active ? 'transparent' : '#C7D2FE'}`,
                  background: active ? "linear-gradient(135deg, #6D28D9, #2563EB)" : "#FFFFFF",
                  color: active ? "#FFFFFF" : "#4F46E5",
                  transition: "all 0.15s ease",
                  boxShadow: active ? "0 3px 10px rgba(109,40,217,0.28)" : "none",
                }}>
                  {tab === "1st" ? "Kinsenas" : "Atrenta"}
                </button>
              );
            })}
          </div>
          <MonthNav
            viewMonth={viewMonth}
            viewYear={viewYear}
            onPrev={goToPrevMonth}
            onSelectMonth={goToMonth}
            onNext={goToNextMonth}
            
          />
        </div>
      </div>

      {/* ── Payment List ── */}
      <PaymentList
        cutoffItems={cutoffItems}
        creditRows={creditRows}
        payments={payments}
        banks={banks}
        viewMonth={viewMonth}
        viewYear={viewYear}
        activeTab={activeTab}
        savingsChecked={savingsChecked}
        savingsGoal={savingsGoal}
        totalIncome={totalIncome}
        onToggleSavings={handleSavingsToggle}
        onPayItem={setPayConfirmItem}
        onViewReceipt={setDashReceiptItem}
        onMarkCreditPaid={(id, rowType) => { setDashCreditPayId(id); setDashCreditPayRowType(rowType); }}
        onViewCredit={(id, rowType) => { setDashCreditViewId(id); setDashCreditViewRowType(rowType); }}
        onViewCreditReceipt={(url) => setDashCreditReceiptUrl(url)}
      />

      {/* ── Owed Section ── */}
      <OwedSection userId={userId} />

      {/* ── Modals ── */}
      {showSahod && (
        <SahodModal banks={banks} activeSalary={activeSalary} onClose={() => setShowSahod(false)} onConfirm={handleSahod} />
      )}
      {showTransfer && (
        <TransferModal banks={banks} initialFromId={transferFromId} onClose={() => { setShowTransfer(false); setTransferFromId(""); }} onConfirm={handleTransfer} />
      )}
      {showBankForm && (
        <BankFormModal bank={editBank} onClose={() => { setShowBankForm(false); setEditBank(null); }} onSave={handleSaveBank} />
      )}
      {payConfirmItem && (
        <PayConfirmModal
          key={payConfirmItem.id}
          item={payConfirmItem}
          banks={banks}
          onClose={() => setPayConfirmItem(null)}
          onConfirm={({ bankId, totalAmount, receiptFile }) => handleTogglePayment(payConfirmItem, bankId, totalAmount, receiptFile)}
        />
      )}
      <ConfirmModal
        isOpen={confirmBankOpen}
        title="Remove Account"
        message={`Remove "${confirmBankName}" from your accounts?`}
        confirmLabel="Remove"
        onConfirm={doDeleteBank}
        onCancel={() => { setConfirmBankOpen(false); setConfirmBankId(null); }}
      />
      {dashReceiptItem && (() => {
        const url = payments[dashReceiptItem.id]?.[viewMonth + 1]?.receipt_url || "";
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.50)", padding: 16 }}>
            <div style={{ width: "100%", maxWidth: 420, borderRadius: 20, overflow: "hidden", background: "white", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #FCD34D", background: "#FFFBEB" }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: "#92400E", margin: 0 }}>Receipt — {dashReceiptItem.name}</p>
                <button onClick={() => setDashReceiptItem(null)} style={{ width: 32, height: 32, borderRadius: 8, background: "#FEF3C7", border: "1px solid #FCD34D", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <X size={15} color="#D97706" />
                </button>
              </div>
              <div style={{ overflowY: "auto", padding: 16, flex: 1 }}>
                {!url ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-faint)" }}>No receipt uploaded</div>
                ) : (
                  <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Receipt" style={{ width: "100%", borderRadius: 10 }} /></a>
                )}
              </div>
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
                <button onClick={() => setDashReceiptItem(null)} style={{ width: "100%", padding: "11px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, background: "#D97706", color: "white", border: "none", cursor: "pointer" }}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}
      {dashCreditPayId && (
        <CreditPayModal
          credit={creditRecords.find(c => c.id === dashCreditPayId) ?? null}
          rowType={dashCreditPayRowType}
          banks={banks}
          onClose={() => { setDashCreditPayId(null); setDashCreditPayRowType(null); }}
          onConfirm={confirmCreditPaid}
        />
      )}
      {dashCreditViewId && (() => {
        const cred = creditRecords.find(c => c.id === dashCreditViewId);
        if (!cred) return null;
        const isPaid = dashCreditViewRowType === "used" ? cred.used_status === "Paid" : cred.due_status === "Paid";
        const payUrl = dashCreditViewRowType === "used" ? cred.used_receipt_url : cred.due_receipt_url;
        const due  = cred.due_date   ? new Date(cred.due_date   + "T00:00:00").toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "—";
        const used = cred.date_taken ? new Date(cred.date_taken + "T00:00:00").toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "—";
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.45)", padding: 16 }}>
            <div style={{ width: "100%", maxWidth: 420, borderRadius: 20, overflow: "hidden", background: "white", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", maxHeight: "88vh" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #E8ECF4", background: "#F5F3FF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CreditCard size={18} color="#7C3AED" />
                  </div>
                  <div>
                    <h2 style={{ fontWeight: 800, color: "#4C1D95", margin: 0, fontSize: 16, fontFamily: "Nunito, sans-serif" }}>{cred.name}</h2>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: isPaid ? "#F0FDF4" : "#FEF2F2", color: isPaid ? "#16A34A" : "#DC2626", border: `1px solid ${isPaid ? "#86EFAC" : "#FECACA"}` }}>
                      {dashCreditViewRowType === "used" ? cred.used_status : cred.due_status}
                    </span>
                  </div>
                </div>
                <button onClick={() => setDashCreditViewId(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={17} /></button>
              </div>
              <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ textAlign: "center", padding: "16px 0", borderRadius: 14, background: isPaid ? "#F0FDF4" : "#FEF2F2", border: `1.5px solid ${isPaid ? "#86EFAC" : "#FECACA"}` }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: isPaid ? "#16A34A" : "#DC2626", margin: "0 0 4px", textTransform: "uppercase" }}>Amount</p>
                  <p style={{ fontSize: 26, fontWeight: 900, color: isPaid ? "#16A34A" : "#DC2626", margin: 0, fontFamily: "Nunito, sans-serif" }}>{formatCurrency(cred.amount)}</p>
                </div>
                {[{ label: "Source", value: cred.source }, { label: "Date Used", value: used }, { label: "Due Date", value: due }, { label: "Notes", value: cred.notes || "—" }].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
                    <span style={{ color: "var(--text-faint)" }}>{row.label}</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)", textAlign: "right", maxWidth: "60%" }}>{row.value}</span>
                  </div>
                ))}
                {(cred.receipt_before || payUrl) && (
                  <div style={{ display: "flex", gap: 10 }}>
                    {cred.receipt_before && <a href={cred.receipt_before} target="_blank" rel="noreferrer" style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 12, fontWeight: 600, color: "var(--primary)", background: "var(--primary-pale)", border: "1px solid var(--primary-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, textDecoration: "none" }}><Eye size={13} /> Receipt</a>}
                    {payUrl && <a href={payUrl} target="_blank" rel="noreferrer" style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 12, fontWeight: 600, color: "#16A34A", background: "#F0FDF4", border: "1px solid #86EFAC", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, textDecoration: "none" }}><Eye size={13} /> Payment Proof</a>}
                  </div>
                )}
              </div>
              <div style={{ padding: "12px 20px 20px", display: "flex", gap: 10, borderTop: "1px solid var(--border)" }}>
                {!isPaid && (
                  <button onClick={() => { setDashCreditViewId(null); setDashCreditPayId(cred.id); setDashCreditPayRowType(dashCreditViewRowType); }}
                    style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "white", background: "#16A34A", border: "none", cursor: "pointer" }}>
                    Mark as Paid
                  </button>
                )}
                <button onClick={() => setDashCreditViewId(null)}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13, fontWeight: 600, background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1px solid var(--border)", cursor: "pointer" }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Owed Section (from hutang table, shown on dashboard) ────────────────────
function OwedSection({ userId }: { userId: string | null }) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    supabase.from("hutang_records").select("*").eq("user_id", userId).neq("status", "Paid").order("created_at", { ascending: false }).limit(5)
      .then(({ data }) => { setRecords(data || []); setLoading(false); });
  }, [userId]);

  if (loading) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px", fontFamily: "Nunito, sans-serif" }}>
        Owed to You
      </h2>
      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", margin: "0 0 12px" }}>
        Track who still owes you money.
      </p>
      <div className="section-card">
        {records.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13, fontFamily: 'Nunito, sans-serif' }}>
            🎉 No one owes you right now.
          </div>
        ) : records.map(r => {
          const pct = r.amount_owed > 0 ? Math.round((r.amount_paid / r.amount_owed) * 100) : 0;
          return (
            <div key={r.id} style={{ padding: "14px 16px", borderBottom: "1px solid #F1F5F9", borderLeft: `3px solid ${pct >= 100 ? '#16a34a' : '#FF8B00'}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", margin: 0, fontFamily: "Nunito, sans-serif" }}>
                  {r.person_name}
                </p>
                <p style={{ fontWeight: 700, fontSize: 13, color: "var(--text-secondary)", margin: 0, fontFamily: 'monospace' }}>
                  {formatCurrency(r.amount_paid)}<span style={{ color: 'var(--text-faint)' }}> / {formatCurrency(r.amount_owed)}</span>
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="owed-bar" style={{ flex: 1 }}>
                  <div className="owed-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 100 ? '#16a34a' : '#FF8B00', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ display: "grid", placeItems: "center", height: 256 }}><div className="spinner" /></div>}>
      <DashboardPageInner />
    </Suspense>
  );
}