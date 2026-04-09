'use client'
import { AlertTriangle, Trash2, X } from 'lucide-react'

interface Props {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  isOpen, title, message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm, onCancel
}: Props) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(13,40,24,0.45)', backdropFilter: 'blur(6px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-surface)',
          border: '1.5px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          animation: 'slide-up 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Icon header */}
        <div className="flex flex-col items-center pt-8 pb-4 px-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: danger ? '#fee2e2' : '#dbeafe',
              border: `2px solid ${danger ? '#fca5a5' : '#93c5fd'}`,
            }}
          >
            {danger
              ? <Trash2 size={28} style={{ color: '#dc2626' }} />
              : <AlertTriangle size={28} style={{ color: '#2563eb' }} />
            }
          </div>
          <h2 className="text-lg font-bold text-center" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <p className="text-sm text-center mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{message}</p>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '0 0 0 0' }} />

        {/* Buttons */}
        <div className="flex gap-0" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onCancel}
            className="flex-1 py-4 text-sm font-semibold transition-colors"
            style={{
              color: 'var(--text-muted)',
              background: 'transparent',
              borderRight: '1px solid var(--border)',
              borderRadius: 0,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-4 text-sm font-bold transition-colors"
            style={{
              color: danger ? '#dc2626' : '#2563eb',
              background: 'transparent',
              borderRadius: 0,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
