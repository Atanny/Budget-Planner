"use client";
import { Eye, EyeOff, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface HeroBannerProps {
  userName: string;
  netWorth: number;
  netHidden: boolean;
  onToggleHidden: () => void;
  onSahodClick: () => void;
}

export default function HeroBanner({
  userName, netWorth, netHidden, onToggleHidden, onSahodClick,
}: HeroBannerProps) {
  return (
    <div style={{
      borderRadius: 20,
      background: "linear-gradient(135deg, #FF8B00 0%, #FF4500 100%)",
      position: "relative",
      overflow: "hidden",
      marginBottom: 18,
      minHeight: 172,
      boxShadow: "0 6px 28px rgba(255,139,0,0.35)",
    }}>
      {/* Decorative circles */}
      <div style={{
        position: "absolute", top: -50, right: -50,
        width: 200, height: 200, borderRadius: "50%",
        background: "rgba(255,255,255,0.07)", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -40, right: 100,
        width: 140, height: 140, borderRadius: "50%",
        background: "rgba(255,255,255,0.05)", pointerEvents: "none",
      }} />

      {/* Left content */}
      <div style={{
        padding: "18px 20px 20px",
        maxWidth: "calc(100% - 145px)",
        position: "relative",
        zIndex: 3,
      }}>
        <p style={{
          color: "rgba(255,255,255,0.90)", fontSize: 12, fontWeight: 600,
          margin: "0 0 8px", fontFamily: "Nunito, sans-serif",
        }}>
          Welcome Back, {userName}
        </p>
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.22)", marginBottom: 10 }} />
        <h2 style={{
          color: "white", fontSize: 26, fontWeight: 900,
          margin: "0 0 1px", fontFamily: "Nunito, sans-serif", letterSpacing: 0.3,
        }}>
          Networth
        </h2>
        <p style={{ color: "rgba(255,255,255,0.68)", fontSize: 11, fontWeight: 500, margin: "0 0 12px" }}>
          Your Monthly Salary
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
          <span style={{ color: "white", fontSize: 20, fontWeight: 900, fontFamily: "Nunito, sans-serif" }}>₱</span>
          <span style={{ color: "white", fontSize: 20, fontWeight: 900, letterSpacing: "0.10em", fontFamily: "Nunito, sans-serif" }}>
            {netHidden ? "••••••" : formatCurrency(netWorth).replace("₱", "").trim()}
          </span>
          <button onClick={onToggleHidden} style={{
            background: "rgba(255,255,255,0.20)", border: "none", borderRadius: 7,
            padding: "4px 7px", cursor: "pointer", display: "flex", alignItems: "center",
          }}>
            {netHidden ? <Eye size={14} color="white" /> : <EyeOff size={14} color="white" />}
          </button>
        </div>
        <button onClick={onSahodClick} style={{
          background: "rgba(255,255,255,0.20)", backdropFilter: "blur(8px)",
          color: "white", border: "1.5px solid rgba(255,255,255,0.38)",
          borderRadius: 999, padding: "8px 16px", fontSize: 12, fontWeight: 700,
          cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
          fontFamily: "Nunito, sans-serif",
        }}>
          <Wallet size={13} /> May Sahod Na!
        </button>
      </div>

      {/* Person image */}
      <div style={{
        position: "absolute", right: 0, bottom: 0, top: 0, width: 145,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        zIndex: 2, pointerEvents: "none",
      }}>
        <img
          src="../Smiling man holding smartphone.png"
          alt=""
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          style={{
            height: "118%", width: "auto", objectFit: "contain", objectPosition: "bottom",
            filter: "drop-shadow(-3px 0 10px rgba(0,0,0,0.12))",
          }}
        />
      </div>
    </div>
  );
}
