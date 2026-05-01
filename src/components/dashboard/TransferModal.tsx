"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { BankAccount } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface TransferModalProps {
  banks: BankAccount[];
  initialFromId?: string;
  onClose: () => void;
  onConfirm: (params: { fromId: string; toId: string; amount: number; note: string; transferFee: number }) => Promise<void>;
}

export default function TransferModal({ banks, initialFromId = "", onClose, onConfirm }: TransferModalProps) {
  const [fromId,      setFromId]      = useState(initialFromId);
  const [toId,        setToId]        = useState("");
  const [amount,      setAmount]      = useState("");
  const [transferFee, setTransferFee] = useState("");
  const [note,        setNote]        = useState("");
  const [saving,      setSaving]      = useState(false);

  const fromBank = banks.find(b => b.id === fromId);
  const toBank   = banks.find(b => b.id === toId);
  const amt      = parseFloat(amount) || 0;
  const fee      = parseFloat(transferFee) || 0;
  const totalDeducted = amt + fee;
  const insufficient = !!(fromBank && totalDeducted > 0 && fromBank.balance < totalDeducted);
  const canSubmit = !!fromId && !!toId && amt > 0 && fromId !== toId && !insufficient;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    await onConfirm({ fromId, toId, amount: amt, note, transferFee: fee });
    setSaving(false);
  }

  const bankBtn = (b: BankAccount, selected: boolean, color: string) => (
    <button key={b.id} onClick={() => b.id === fromId ? setFromId(b.id) : setToId(b.id)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${selected ? color : "var(--border)"}`, background: selected ? (color === "#dc2626" ? "#fef2f2" : "#eff6ff") : "var(--bg-subtle)", cursor: "pointer", textAlign: "left" }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: selected ? color : "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</p>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>{formatCurrency(b.balance)}</span>
      {selected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center modal-overlay p-4">
      <div className="w-full max-w-md mx-auto slide-up rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-surface)", border: "1.5px solid #0f172a", boxShadow: "0 8px 32px rgba(15,23,42,0.16)", display: "flex", flexDirection: "column", maxHeight: "88vh" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #bbf7d0", background: "#f0fdf4", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontWeight: 700, color: "#14532d", margin: 0 }}>⇄ Transfer Money</h2>
            <p style={{ fontSize: 12, color: "#16a34a", margin: "2px 0 0" }}>Move funds between your accounts</p>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* From */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-secondary)" }}>From Account</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {banks.map(b => (
                <button key={b.id} onClick={() => setFromId(b.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${fromId === b.id ? "#dc2626" : "var(--border)"}`, background: fromId === b.id ? "#fef2f2" : "var(--bg-subtle)", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: fromId === b.id ? "#dc2626" : "var(--text-primary)", margin: 0 }}>{b.name}</p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>{formatCurrency(b.balance)}</span>
                  {fromId === b.id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626" }} />}
                </button>
              ))}
            </div>
          </div>

          {/* To */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-secondary)" }}>To Account</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {banks.filter(b => b.id !== fromId).map(b => (
                <button key={b.id} onClick={() => setToId(b.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${toId === b.id ? "#2563EB" : "var(--border)"}`, background: toId === b.id ? "#eff6ff" : "var(--bg-subtle)", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: toId === b.id ? "#1d4ed8" : "var(--text-primary)", margin: 0 }}>{b.name}</p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>{formatCurrency(b.balance)}</span>
                  {toId === b.id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB" }} />}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block", color: "var(--text-secondary)" }}>Amount (₱)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 text-sm" style={{ textAlign: "center" }} />
          </div>

          {/* Transfer Fee */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block", color: "var(--text-secondary)" }}>
              Transfer Fee (₱) <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>— optional</span>
            </label>
            <input type="number" value={transferFee} onChange={e => setTransferFee(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 text-sm" style={{ textAlign: "center" }} />
            {fee > 0 && (
              <p style={{ fontSize: 11, color: "#d97706", margin: "4px 0 0", fontFamily: "Nunito, sans-serif" }}>
                ⚠️ Fee will be deducted from <strong>{fromBank?.name || "source"}</strong>. Total deducted: {formatCurrency(totalDeducted)}
              </p>
            )}
          </div>

          {/* Note */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block", color: "var(--text-secondary)" }}>
              Note <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>— optional</span>
            </label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. for bills, savings..." className="w-full px-3 py-2.5 text-sm" />
          </div>

          {/* Summary */}
          {fromId && toId && amt > 0 && (
            <div style={{ padding: "10px 12px", borderRadius: 10, background: insufficient ? "#fef2f2" : "var(--bg-subtle)", border: `1.5px solid ${insufficient ? "#fca5a5" : "#E2E8F0"}`, fontSize: 12 }}>
              {insufficient ? (
                <p style={{ color: "#dc2626", fontWeight: 600, margin: 0 }}>⚠️ Insufficient balance in {fromBank?.name} ({formatCurrency(fromBank?.balance || 0)} available)</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-muted)" }}>{fromBank?.name} <span style={{ color: "#94a3b8" }}>→</span> {toBank?.name}</span>
                    <span style={{ fontWeight: 700, fontFamily: "monospace", color: "#16a34a" }}>+{formatCurrency(amt)}</span>
                  </div>
                  {fee > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-faint)" }}>Transfer fee</span>
                      <span style={{ fontWeight: 700, fontFamily: "monospace", color: "#dc2626" }}>−{formatCurrency(fee)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: fee > 0 ? "1px solid #e2e8f0" : "none", paddingTop: fee > 0 ? 4 : 0, marginTop: fee > 0 ? 2 : 0 }}>
                    <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Total deducted from {fromBank?.name}</span>
                    <span style={{ fontWeight: 700, fontFamily: "monospace", color: "#dc2626" }}>−{formatCurrency(totalDeducted)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px 20px", display: "flex", gap: 12, flexShrink: 0, borderTop: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <button onClick={onClose} className="btn-cancel" style={{ flex: 1 }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit || saving}
            style={{ flex: 2, padding: "10px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, color: "white", background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", cursor: "pointer", opacity: (!canSubmit || saving) ? 0.4 : 1 }}>
            {saving ? "Transferring..." : "⇄ Transfer"}
          </button>
        </div>
      </div>
    </div>
  );
}