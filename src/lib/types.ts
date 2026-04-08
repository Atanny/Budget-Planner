export type Cutoff = '1st' | '2nd'
export type PaymentStatus = 'Required' | 'Optional' | 'First Payment' | 'Last Payment' | 'Once' | 'Suspended' | 'Paid'

export interface UserSettings {
  id: string
  user_id: string
  first_cutoff_salary: number
  second_cutoff_salary: number
  savings_goal: number
  notifications_enabled: boolean
  push_subscription: PushSubscriptionJSON | null
}

export interface BudgetItem {
  id: string
  user_id: string
  name: string
  amount: number
  cutoff: Cutoff
  status: PaymentStatus
  is_loan: boolean
  is_active: boolean
  sort_order: number
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
  'Last Payment': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Once: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Suspended: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  Paid: 'bg-green-500/20 text-green-400 border-green-500/30',
}
