"use client";
import { useState } from "react";
import { X, Check, Star } from "lucide-react";
import { BankAccount, BANK_TYPES } from "@/lib/types";

const COLORS = ["#881520","#1a3a8f","#1a5c3a","#1a4a6e","#6b1a6e","#7a4000","#1a3a5c","#2d6a2d","#b45309","#0f4c75","#3d3d3d","#1e3a4a"];

interface BankFormModalProps {
  bank: BankAccount | null;
  onClose: () => void;
  onSave: (data: any) => void;
}

export default function BankFormModal({ bank, onClose, onSave }: BankFormModalProps) {
  const [name,     setName]     = useState(bank?.name     || "");
  const [type,     setType]     = useState<BankAccount["type"]>(bank?.type || "bank");
  const [balance,  setBalance]  = useState(bank?.balance?.toString() || "");
  const [color,    setColor]    = useState(bank?.color    || "#881520");
  const [isMain,   setIsMain]   = useState(bank?.is_main_bank || false);
  const [isCredit, setIsCredit] = useState(bank?.is_credit    || false);

  function handleSave() {
    onSave({ name, type, balance: parseFloat(balance) || 0, color, is_main_bank: !isCredit && isMain, is_credit: isCredit });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center modal-overlay p-4">
      <div className="w-full max-w-md mx-auto slide-up rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-surface)", border: "1.5px solid #0f172a", boxShadow: "0 8px 32px rgba(15,23,42,0.16)" }}>

        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#93c5fd", background: "#eff6ff" }}>
          <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>{bank ? "Edit Account" : "Add Account"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}><X size={17} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Account Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. GCash, BDO Savings..." className="w-full px-3 py-2.5 text-sm" />
          </div>

          {/* Credit / Regular toggle */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setIsCredit(false); if (type === "credit") setType("bank"); }}
              style={{ flex: 1, padding: "11px 0", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1.5px solid", background: !isCredit ? "#eff6ff" : "var(--bg-subtle)", color: !isCredit ? "#2563EB" : "var(--text-muted)", borderColor: !isCredit ? "#2563EB" : "var(--border)" }}>
              🏦 Savings / Bank
            </button>
            <button onClick={() => { setIsCredit(true); setType("credit"); }}
              style={{ flex: 1, padding: "11px 0", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1.5px solid", background: isCredit ? "#f5f3ff" : "var(--bg-subtle)", color: isCredit ? "#7c3aed" : "var(--text-muted)", borderColor: isCredit ? "#7c3aed" : "var(--border)" }}>
              💳 Credits
            </button>
          </div>

          {/* Account type grid (non-credit) */}
          {!isCredit && (
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Account Type</label>
              <div className="grid grid-cols-3 gap-2">
                {BANK_TYPES.filter(t => t.value !== "credit").map(t => (
                  <button key={t.value} onClick={() => setType(t.value)} className="p-2.5 rounded-xl text-center transition-all"
                    style={{ background: type === t.value ? `${t.color}18` : "var(--bg-subtle)", border: `1.5px solid ${type === t.value ? t.color : "var(--border)"}` }}>
                    <p style={{ fontSize: 16 }}>{t.label.split(" ")[0]}</p>
                    <p style={{ fontSize: 10, fontWeight: 700, color: type === t.value ? t.color : "var(--text-faint)" }}>{t.label.split(" ").slice(1).join(" ")}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isCredit && (
            <div style={{ padding: "10px 12px", borderRadius: 12, background: "#f5f3ff", border: "1.5px solid #ddd6fe" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#6d28d9", margin: "0 0 2px" }}>💳 Credit Account</p>
              <p style={{ fontSize: 11, color: "#7c3aed", margin: 0 }}>This account will appear as a credit source in the Credits page.</p>
            </div>
          )}

          {/* Balance */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>{isCredit ? "Credit Limit (₱)" : "Current Balance (₱)"}</label>
            <input type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 text-sm" />
          </div>

          {/* Main bank toggle */}
          {!isCredit && (
            <button onClick={() => setIsMain(!isMain)} className="w-full flex items-center justify-between p-3 rounded-xl transition-all"
              style={{ background: isMain ? "#dbeafe" : "var(--bg-subtle)", border: `1.5px solid ${isMain ? "#93c5fd" : "var(--border)"}` }}>
              <div className="flex items-center gap-2.5">
                <Star size={16} style={{ color: isMain ? "#2563eb" : "var(--text-faint)" }} fill={isMain ? "#2563eb" : "none"} />
                <div className="text-left">
                  <p className="text-sm font-bold" style={{ color: isMain ? "#1d4ed8" : "var(--text-primary)" }}>Set as Main Bank</p>
                  <p className="text-xs" style={{ color: isMain ? "#3b82f6" : "var(--text-faint)" }}>Where your salary (sahod) goes</p>
                </div>
              </div>
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: isMain ? "#2563eb" : "var(--bg-subtle)", border: `2px solid ${isMain ? "#2563eb" : "var(--border-strong)"}` }}>
                {isMain && <Check size={11} className="text-white" />}
              </div>
            </button>
          )}

          {/* Color picker */}
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--text-secondary)" }}>Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} className="w-7 h-7 rounded-full transition-all"
                  style={{ background: c, border: `3px solid ${color === c ? "var(--text-primary)" : "transparent"}`, outline: `2px solid ${color === c ? c : "transparent"}`, outlineOffset: 2 }} />
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1.5px solid #0f172a" }}>Cancel</button>
          <button onClick={handleSave} disabled={!name} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: isCredit ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "linear-gradient(135deg, var(--brand), var(--brand-light))" }}>
            {bank ? "Save Changes" : "Add Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
