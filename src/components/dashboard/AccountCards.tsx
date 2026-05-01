"use client";
import { useRef, useEffect, useState } from "react";
import { Plus, Eye, EyeOff, Edit2, Trash2, ArrowLeftRight, MoreHorizontal } from "lucide-react";
import { BankAccount } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import FloatingMenu from "@/components/FloatingMenu";

interface AccountCardsProps {
  banks: BankAccount[];
  onAddAccount: () => void;
  onEditAccount: (bank: BankAccount) => void;
  onDeleteAccount: (id: string, name: string) => void;
  onTransfer: (fromId: string) => void;
}

function getBankColor(bank: BankAccount): { bg: string; text: string } {
  const n = bank.name?.toLowerCase() ?? "";
  if (n.includes("bpi"))     return { bg: "#8B1A1A", text: "#FFFFFF" };
  if (n.includes("maya"))    return { bg: "#065F46", text: "#FFFFFF" };
  if (n.includes("gcash"))   return { bg: "#1741C4", text: "#FFFFFF" };
  if (n.includes("cash"))    return { bg: "#065F46", text: "#FFFFFF" };
  if (n.includes("seabank")) return { bg: "#0E7490", text: "#FFFFFF" };
  if (n.includes("bdo"))     return { bg: "#1E3A5F", text: "#FFFFFF" };
  const palette = [
    { bg: "#1E3A5F", text: "#FFFFFF" },
    { bg: "#3730A3", text: "#FFFFFF" },
    { bg: "#065F46", text: "#FFFFFF" },
    { bg: "#7C2D12", text: "#FFFFFF" },
    { bg: "#4C1D95", text: "#FFFFFF" },
  ];
  return palette[(bank.name?.charCodeAt(0) ?? 0) % palette.length];
}

function getBankTypeLabel(bank: BankAccount): string {
  const t = bank.type?.toLowerCase() ?? "";
  if (t === "debit")  return "Debit • PHP";
  if (t === "credit") return "Credit • PHP";
  if (t === "wallet") return "Wallet • PHP";
  if (t === "cash")   return "Cash • PHP";
  return "Bank • PHP";
}

export default function AccountCards({
  banks, onAddAccount, onEditAccount, onDeleteAccount, onTransfer,
}: AccountCardsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden]     = useState<Record<string, boolean>>({});
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem("cardHidden");
      if (s) setHidden(JSON.parse(s));
    } catch {}
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const h = () => setOpenMenu(null);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [openMenu]);

  function toggleHide(id: string) {
    setHidden(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem("cardHidden", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const displayBanks = banks.filter(b => !b.is_required && b.name !== "Cash");

  return (
    <div style={{ marginBottom: 18 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: 0, fontFamily: "Nunito, sans-serif" }}>
          Accounts
        </h2>
        <button
          onClick={onAddAccount}
          style={{
            background: "var(--primary)", color: "white", border: "none",
            borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            fontFamily: "Nunito, sans-serif",
            boxShadow: "0 2px 8px rgba(109,40,217,0.25)",
          }}
        >
          <Plus size={12} /> Add Account
        </button>
      </div>

      {/* Floating menu */}
      <FloatingMenu
        isOpen={!!openMenu}
        anchorId={openMenu ? `accard-${openMenu}` : "accard-anchor"}
        minWidth={172}
        onClose={() => setOpenMenu(null)}
      >
        {(() => {
          const b = banks.find(x => x.id === openMenu);
          if (!b) return null;
          const isCash = b.is_required || b.name === "Cash";
          return (
            <>
              <button onClick={e => { e.stopPropagation(); onEditAccount(b); setOpenMenu(null); }}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 16px", width: "100%", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "Nunito, sans-serif" }}>
                <Edit2 size={14} style={{ color: "var(--primary)" }} /> Edit Account
              </button>
              <button onClick={e => { e.stopPropagation(); onTransfer(b.id); setOpenMenu(null); }}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 16px", width: "100%", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "Nunito, sans-serif" }}>
                <ArrowLeftRight size={14} style={{ color: "var(--primary)" }} /> Transfer
              </button>
              {!isCash && (
                <button onClick={e => { e.stopPropagation(); onDeleteAccount(b.id, b.name); setOpenMenu(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 16px", width: "100%", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#DC2626", fontFamily: "Nunito, sans-serif" }}>
                  <Trash2 size={14} /> Remove Account
                </button>
              )}
            </>
          );
        })()}
      </FloatingMenu>

      {/* Card scroll */}
      <div ref={scrollRef} style={{
        display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4,
        scrollbarWidth: "none", msOverflowStyle: "none",
      }}>
        {displayBanks.length === 0 ? (
          <div style={{
            flex: 1, borderRadius: 16, border: "2px dashed #E2E8F0",
            padding: "24px 20px", textAlign: "center",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 180,
          }}>
            <Plus size={20} style={{ color: "#CBD5E1" }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-faint)", margin: 0 }}>No accounts yet</p>
            <button onClick={onAddAccount} style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Add Account
            </button>
          </div>
        ) : displayBanks.map(bank => {
          const { bg, text } = getBankColor(bank);
          const isHidden = hidden[bank.id];
          const isMain   = bank.is_main_bank;
          const bal      = formatCurrency(bank.balance);
          const initial  = bank.name?.[0]?.toUpperCase() ?? "B";

          return (
            <div key={bank.id} style={{
              minWidth: 252,
              borderRadius: 18,
              background: bg,
              padding: "18px 16px 16px",
              position: "relative",
              overflow: "hidden",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 4px 18px rgba(0,0,0,0.18)",
            }}>
              {/* Deco circle */}
              <div style={{
                position: "absolute", top: -28, right: -28, width: 96, height: 96,
                borderRadius: "50%", background: "rgba(255,255,255,0.07)", pointerEvents: "none",
              }} />

              {/* ── Top row: icon + name + menu ── */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: "rgba(255,255,255,0.18)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 900, fontSize: 13, color: text, fontFamily: "Nunito, sans-serif",
                    flexShrink: 0,
                  }}>
                    {initial}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: text, margin: 0, fontFamily: "Nunito, sans-serif", lineHeight: 1.2 }}>
                      {bank.name}
                    </p>
                    {isMain && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(255,255,255,0.20)", color: text, alignSelf: "flex-start" }}>
                        Main
                      </span>
                    )}
                  </div>
                </div>
                <button
                  id={`accard-${bank.id}`}
                  onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === bank.id ? null : bank.id); }}
                  style={{
                    background: "rgba(255,255,255,0.13)", border: "none", borderRadius: 8,
                    width: 28, height: 28, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: text, flexShrink: 0,
                    transition: "background 0.15s",
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>

              {/* ── Divider ── */}
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.14)", marginBottom: 14 }} />

              {/* ── Type label ── */}
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.55)", margin: "0 0 14px", letterSpacing: "0.02em" }}>
                {getBankTypeLabel(bank)}
              </p>

              {/* ── Balance section ── */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.55)", margin: "0 0 6px", letterSpacing: "0.02em" }}>
                  Balance
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: text, letterSpacing: "0.08em", fontFamily: "Nunito, sans-serif", lineHeight: 1 }}>
                    {isHidden ? "₱ ••••••" : bal}
                  </span>
                  <button onClick={e => { e.stopPropagation(); toggleHide(bank.id); }}
                    style={{ background: "rgba(255,255,255,0.14)", border: "none", borderRadius: 7, padding: "4px 6px", cursor: "pointer", display: "flex", alignItems: "center", transition: "background 0.15s" }}>
                    {isHidden ? <Eye size={12} color={text} /> : <EyeOff size={12} color={text} />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}