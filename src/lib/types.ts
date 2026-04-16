export type Cutoff = '1st' | '2nd'
export type PaymentStatus = 'Required' | 'Optional' | 'First Payment' | 'Last Payment' | 'Once' | 'Suspended' | 'Paid'

export interface SalaryHistory {
  id: string
  user_id: string
  year: number
  month: number   // 1-12
  first_cutoff_salary: number
  second_cutoff_salary: number
  extra_income_1st: number
  extra_income_2nd: number
  savings_goal: number
}

export interface UserSettings {
  extra_income_1st: number
  extra_income_2nd: number
  id: string
  user_id: string
  first_cutoff_salary: number
  second_cutoff_salary: number
  savings_goal: number
  notifications_enabled: boolean
  push_subscription: PushSubscriptionJSON | null
  total_salary_received: number
}

export interface BudgetItem {
  id: string
  user_id: string
  name: string
  amount: number
  cutoff: Cutoff
  status: PaymentStatus
  is_loan: boolean
  category: string
  bank_account_id?: string | null
  is_active: boolean
  sort_order: number
  created_at?: string
  loan_details?: LoanDetail
  monthly_payments?: MonthlyPayment[]
}

export interface LoanDetail {
  id: string
  budget_item_id: string
  user_id: string
  total_months: number
  start_date: string
  notes?: string
}

export interface MonthlyPayment {
  id: string
  budget_item_id: string
  user_id: string
  year: number
  month: number
  paid: boolean
  paid_at?: string
}

export interface MonthlySavings {
  id: string
  user_id: string
  year: number
  month: number
  kinsenas: number
  atrenta: number
  notes?: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  cutoff: '1st' | '2nd' | 'general'
  scheduled_for?: string
  sent: boolean
}

export interface PushSubscriptionJSON {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
export const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
export const STATUS_OPTIONS: PaymentStatus[] = ['Required','Optional','First Payment','Last Payment','Once','Suspended','Paid']
export const STATUS_COLORS: Record<PaymentStatus, string> = {
  Required: 'bg-red-500/20 text-red-400 border-red-500/30',
  Optional: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'First Payment': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Last Payment': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Once: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Suspended: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  Paid: 'bg-green-500/20 text-green-400 border-green-500/30',
}

// Light-theme badge class map
export const BADGE_CLASSES: Record<PaymentStatus, string> = {
  Required:        'badge-required',
  Optional:        'badge-optional',
  'First Payment': 'badge-first',
  'Last Payment':  'badge-last',
  Once:            'badge-once',
  Suspended:       'badge-suspended',
  Paid:            'badge-paid',
}

export const EXPENSE_CATEGORIES = [
  { value: 'Food',         label: '🍱 Food & Dining',     color: '#f97316' },
  { value: 'Transport',    label: '🚗 Transport',          color: '#3b82f6' },
  { value: 'Utilities',    label: '💡 Utilities',          color: '#eab308' },
  { value: 'Subscription', label: '📱 Subscriptions',      color: 'var(--accent)' },
  { value: 'Healthcare',   label: '🏥 Healthcare',         color: 'var(--brand)' },
  { value: 'Shopping',     label: '🛍️ Shopping',           color: 'var(--brand)' },
  { value: 'Education',    label: '📚 Education',          color: '#06b6d4' },
  { value: 'Loan',         label: '🏦 Loan / Installment', color: '#6366f1' },
  { value: 'Rent',         label: '🏠 Rent / Housing',     color: 'var(--brand-dark)' },
  { value: 'Savings',      label: '💰 Savings Transfer',   color: '#10b981' },
  { value: 'Other',        label: '📌 Other',              color: '#94a3b8' },
]

export const BANK_TYPES = [
  { value: 'bank'        as const, label: '🏦 Bank',         color: '#3b82f6' },
  { value: 'ewallet'     as const, label: '📲 E-Wallet',     color: 'var(--brand-dark)' },
  { value: 'cash'        as const, label: '💵 Cash',         color: 'var(--brand)' },
  { value: 'investment'  as const, label: '📈 Investment',   color: 'var(--accent)' },
  { value: 'other'       as const, label: '🗃️ Other',        color: '#94a3b8' },
]

export interface TransactionLog {
  id: string
  user_id: string
  budget_item_id?: string | null
  action: 'add' | 'edit' | 'delete' | 'paid' | 'unpaid'
  item_name: string
  amount: number
  category?: string | null
  payment_method?: string | null
  cutoff?: string | null
  notes?: string | null
  created_at: string
}

export interface BankAccount {
  id: string
  user_id: string
  name: string
  type: 'bank' | 'ewallet' | 'cash' | 'investment' | 'other'
  balance: number
  color: string
  category: string
  bank_account_id?: string | null
  is_active: boolean
  sort_order: number
  is_main_bank: boolean
  is_required?: boolean
}
