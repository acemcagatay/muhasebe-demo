export interface Invoice {
  id: number;
  title: string;
  amount: number;
  kdv_rate: number;
  withholding_rate: number;
  date: string;
  due_days: number;
  due_date: string;
  description?: string;
  is_paid: number;
}

export interface Expense {
  id: number;
  title: string;
  amount: number;
  kdv_rate: number;
  date: string;
  category?: string;
  description?: string;
}

export interface Prepayment {
  id: number;
  title: string;
  amount: number;
  date: string;
  description?: string;
}

export interface Summary {
  totalIncome: number;
  totalPrepayments: number;
  remainingReceivable: number;
  totalExpense: number;
  totalIncomeKdv: number;
  totalExpenseKdv: number;
  totalWithholding: number;
  netIncome: number;
  estimatedIncomeTax: number;
  payableKdv: number;
  totalTax: number;
  netProfitAfterTax: number;
}
