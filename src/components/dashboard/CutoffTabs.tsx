"use client";
import { Cutoff } from "@/lib/types";

interface CutoffTabsProps {
  activeTab: Cutoff;
  onChange: (tab: Cutoff) => void;
}

export default function CutoffTabs({ activeTab, onChange }: CutoffTabsProps) {
  return (
    <div style={{
      display: "flex",
      gap: 8,
      marginBottom: 14,
    }}>
      {(["1st", "2nd"] as Cutoff[]).map(tab => {
        const active = activeTab === tab;
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            style={{
              padding: "10px 22px",
              borderRadius: 999,
              fontFamily: "Nunito, sans-serif",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              border: `1.5px solid ${active ? "#4F46E5" : "#C7D2FE"}`,
              background: active ? "#4F46E5" : "#FFFFFF",
              color: active ? "#FFFFFF" : "#4F46E5",
              transition: "all 0.15s ease",
              boxShadow: active ? "0 3px 10px rgba(79,70,229,0.25)" : "none",
            }}
          >
            {tab === "1st" ? "1st Cutoff" : "2nd Cutoff"}
          </button>
        );
      })}
    </div>
  );
}
