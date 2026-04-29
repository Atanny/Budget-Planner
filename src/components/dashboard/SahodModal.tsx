"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { BankAccount, UserSettings, SalaryHistory } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface SahodModalProps {
  banks: BankAccount[];
  activeSalary: (UserSettings | SalaryHistory | null);
  onClose: () => void;
  onConfirm: (params: {
    amount: number;
    extra: number;
    cutoff: "1st" | "2nd";
    bankId: string;
  }) => Promise<void>;
}

export default function SahodModal({ banks, activeSalary, onClose, onConfirm }: SahodModalProps) {
  const [sahodAmount,  setSahodAmount]  = useState("");
  const [sahodCutoff,  setSahodCutoff]  = useState<"1st" | "2nd">("1st");
  const [sahodExtra,   setSahodExtra]   = useState("");
  const [sahodBankId,  setSahodBankId]  = useState("");
  const [saving,       setSaving]       = useState(false);

  async function handleSubmit() {
    if (!sahodAmount) return;
    setSaving(true);
    await onConfirm({
      amount: parseFloat(sahodAmount),
      extra:  parseFloat(sahodExtra) || 0,
      cutoff: sahodCutoff,
      bankId: sahodBankId,
    });
    setSaving(false);
  }

  const targetBank = banks.find(b => b.id === sahodBankId) || banks.find(b => b.is_main_bank);
  const total = (parseFloat(sahodAmount) || 0) + (parseFloat(sahodExtra) || 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center modal-overlay p-4">
      <div className="w-full max-w-md mx-auto slide-up rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-surface)", border: "1.5px solid #0f172a", boxShadow: "0 8px 32px rgba(15,23,42,0.16)", display: "flex", flexDirection: "column", maxHeight: "88vh" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #93c5fd", background: "#eff6ff", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontWeight: 700, color: "#1e3a5f", margin: 0 }}>💸 May Sahod Na!</h2>
            <p style={{ fontSize: 12, color: "#3b82f6", margin: "2px 0 0" }}>Choose where to add your salary</p>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Cutoff selector */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-secondary)" }}>Which Cutoff?</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {([
                { label: "1st Cutoff (15th)", val: "1st" as const, salary: (activeSalary as any)?.first_cutoff_salary || 0 },
                { label: "2nd Cutoff (30th)", val: "2nd" as const, salary: (activeSalary as any)?.second_cutoff_salary || 0 },
              ]).map(opt => (
                <button key={opt.val} onClick={() => { setSahodCutoff(opt.val); setSahodAmount(opt.salary.toString()); }}
                  style={{ padding: "10px 8px", borderRadius: 12, textAlign: "center", cursor: "pointer", background: sahodCutoff === opt.val ? "#dbeafe" : "var(--bg-subtle)", border: `1.5px solid ${sahodCutoff === opt.val ? "#93c5fd" : "var(--border)"}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", margin: 0 }}>{opt.label}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "#2563eb", margin: 0 }}>{formatCurrency(opt.salary)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Bank selector */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-secondary)" }}>Add to Account</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {banks.map(b => {
                const selected = sahodBankId ? sahodBankId === b.id : b.is_main_bank;
                return (
                  <button key={b.id} onClick={() => setSahodBankId(b.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${selected ? "#2563EB" : "var(--border)"}`, background: selected ? "#eff6ff" : "var(--bg-subtle)", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: selected ? "#1d4ed8" : "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>{b.name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-faint)", margin: 0 }}>{b.type}{b.is_main_bank ? " · Main" : ""}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>{formatCurrency(b.balance)}</span>
                    {selected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB", flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
            {targetBank && !targetBank.is_main_bank && (
              <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "#fff7ed", border: "1.5px solid #fed7aa", display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: 15, lineHeight: 1, marginTop: 1 }}>ℹ️</span>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#c2410c", margin: 0 }}>
                  Balance will be added to <strong>{targetBank.name}</strong>, but your <strong>salary figures won't update</strong> since this isn't your main account.
                </p>
              </div>
            )}
          </div>

          {/* Salary amount */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block", color: "var(--text-secondary)" }}>Salary Amount (₱)</label>
            <input type="number" value={sahodAmount} onChange={e => setSahodAmount(e.target.value)} placeholder="Enter sahod amount..." className="w-full px-3 py-2.5 text-sm" autoFocus style={{ textAlign: "center" }} />
          </div>

          {/* Extra income */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block", color: "var(--text-secondary)" }}>
              Extra Income (₱) <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>— optional</span>
            </label>
            <input type="number" value={sahodExtra} onChange={e => setSahodExtra(e.target.value)} placeholder="Bonus, allowance, etc..." className="w-full px-3 py-2.5 text-sm" style={{ textAlign: "center" }} />
          </div>

          {total > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "var(--bg-subtle)", border: "1.5px solid #0f172a", fontSize: 12 }}>
              <span style={{ color: "var(--text-muted)" }}>Total adding to <strong>{targetBank?.name || "account"}</strong></span>
              <span style={{ fontWeight: 700, fontFamily: "monospace", color: "#2563eb" }}>{formatCurrency(total)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px 20px", display: "flex", gap: 12, flexShrink: 0, borderTop: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <button onClick={onClose} className="btn-cancel" style={{ flex: 1 }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!sahodAmount || saving}
            style={{ flex: 1, padding: "10px 0", borderRadius: 999, fontSize: 14, fontWeight: 700, color: "white", background: "linear-gradient(135deg, #2563eb, #1d4ed8)", border: "none", cursor: "pointer", opacity: (!sahodAmount || saving) ? 0.5 : 1 }}>
            {saving ? "Adding..." : "Add Sahod 💸"}
          </button>
        </div>
      </div>
    </div>
  );
}