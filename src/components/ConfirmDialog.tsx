'use client'
import { AlertTriangle, Trash2, X } from 'lucide-react'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center modal-overlay p-4">
      <div
        className="w-full max-w-sm slide-up rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(13,40,24,0.20)',
        }}>
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 border-b"
          style={{
            borderColor: danger ? '#fca5a5' : 'var(--border)',
            background: danger ? '#fff5f5' : 'var(--bg-subtle)',
          }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: danger ? '#fee2e2' : 'var(--green-50)' }}>
            {danger ? <Trash2 size={16} style={{ color: '#dc2626' }} /> : <AlertTriangle size={16} style={{ color: 'var(--amber-500)' }} />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: 'var(--text-faint)', background: 'var(--bg-subtle)' }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{message}</p>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: 'var(--bg-subtle)',
              color: 'var(--text-muted)',
              border: '1.5px solid var(--border)',
            }}>
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
            style={{
              background: danger
                ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                : 'linear-gradient(135deg, var(--green-500), var(--green-400))',
              boxShadow: danger ? '0 2px 8px rgba(220,38,38,0.3)' : '0 2px 8px rgba(34,112,58,0.3)',
            }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
