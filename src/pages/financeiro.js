import { store } from '../store.js';
import { refreshIcons } from '../icons.js';

const CATEGORIES_INCOME = ['Salário', 'Freelance', 'Investimentos', 'Outros'];
const CATEGORIES_EXPENSE = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Educação', 'Vestuário', 'Outros'];
const SOURCES = ['Conta Corrente', 'Cartão Visa', 'Cartão Mastercard'];

const DEFAULT_RECURRING_DEBTS = [
  { id: 1, icon: 'droplets', name: 'Água', amount: 120, dueDay: 9, paidMonths: [] },
  { id: 2, icon: 'zap', name: 'Luz', amount: 210, dueDay: 10, paidMonths: [] },
  { id: 3, icon: 'house', name: 'Aluguel', amount: 1450, dueDay: 5, paidMonths: [] },
  { id: 4, icon: 'wifi', name: 'Internet', amount: 99, dueDay: 12, paidMonths: [] },
];

const DEFAULT_ACTIVE_DEBTS = [
  { id: 1, description: 'Empréstimo Pessoal', total: 12000, remaining: 7200, installmentAmount: 600, totalInstallments: 20, paidInstallments: 8, nextInstallment: '2026-04-15', status: 'ativo', paidInstallmentMonths: [] },
  { id: 2, description: 'Parcelamento Notebook', total: 4200, remaining: 1400, installmentAmount: 350, totalInstallments: 12, paidInstallments: 8, nextInstallment: '2026-04-22', status: 'ativo', paidInstallmentMonths: [] },
  { id: 3, description: 'Financiamento Moto', total: 18500, remaining: 9700, installmentAmount: 480, totalInstallments: 39, paidInstallments: 19, nextInstallment: '2026-05-03', status: 'em dia', paidInstallmentMonths: [] },
];

const DEFAULT_CREDIT_CARDS = [
  { id: 1, brand: 'Visa', last4: '4821', closingDay: 8, limitTotal: 8000, limitUsed: 2150 },
  { id: 2, brand: 'Mastercard', last4: '1137', closingDay: 12, limitTotal: 5000, limitUsed: 1325 },
];

const DEFAULT_RECURRING_INCOMES = [
  { id: 1, icon: 'briefcase-business', name: 'Salário Mensal', amount: 5000, expectedDay: 1, receivedMonths: ['2026-04'] },
  { id: 2, icon: 'laptop', name: 'Freelance', amount: 1200, expectedDay: 16, receivedMonths: [] },
];

const DEFAULT_INVESTMENTS = [
  { id: 1, name: 'Carteira Principal', monthlyContribution: 340, monthlyRate: 1.2, startMonth: '2026-04' },
];

let _selectedType = 'expense';
let _historyGroup = 'day';
let _historyFilter = 'all';
let _expandedTransactionId = null;
let _payAllModalOpen = false;
let _statementCardId = null;
let _editingTransactionId = null;
let _editingRecurringDebtId = null;
let _editingActiveDebtId = null;
let _editingCreditCardId = null;
let _editingRecurringIncomeId = null;
let _creditCardComposerOpen = false;
let _financeDeleteDialog = null;

function fmt(n) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function todayDate() {
  return new Date().toISOString().split('T')[0];
}

function monthKey(dateStr = todayDate()) {
  return String(dateStr).slice(0, 7);
}

function currentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1).toISOString().split('T')[0];
  const end = new Date(year, month + 1, 0).toISOString().split('T')[0];
  return { start, end };
}

function inCurrentMonth(dateStr) {
  const { start, end } = currentMonthRange();
  return dateStr >= start && dateStr <= end;
}

function parseMoneyInput(value) {
  const normalized = String(value || '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
}

function formatMoneyInput(value) {
  const num = parseMoneyInput(value);
  return num > 0 ? fmt(num) : '';
}

function formatPtDate(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR');
}

function toInputDateFromOffset(daysOffset) {
  const d = new Date(`${todayDate()}T12:00:00`);
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

function inferCategory(desc, type) {
  const text = String(desc || '').toLowerCase();
  if (type === 'income') {
    if (/sal[aá]rio/.test(text)) return 'Salário';
    if (/free|freela|projeto/.test(text)) return 'Freelance';
    if (/invest|dividend/.test(text)) return 'Investimentos';
    return 'Outros';
  }

  if (/mercado|padaria|restaurante|ifood|comida/.test(text)) return 'Alimentação';
  if (/uber|gasolina|combust[ií]vel|metr[oô]|onibus|transporte/.test(text)) return 'Transporte';
  if (/aluguel|condom[ií]nio|moradia/.test(text)) return 'Moradia';
  if (/farm[aá]cia|m[eé]dico|sa[uú]de/.test(text)) return 'Saúde';
  if (/cinema|lazer|viagem/.test(text)) return 'Lazer';
  if (/curso|livro|educa/.test(text)) return 'Educação';
  if (/roupa|tenis|vestu[aá]rio/.test(text)) return 'Vestuário';
  return 'Outros';
}

function parseSmartInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const amountMatch = raw.match(/r\$\s*([\d.,]+)/i) || raw.match(/(^|\s)(\d+[\d.,]*)(?=\s|$)/);
  const amount = amountMatch ? parseMoneyInput(amountMatch[1] || amountMatch[2]) : 0;
  if (!amount) return null;

  const lowered = raw.toLowerCase();
  let date = todayDate();
  if (/anteontem/.test(lowered)) date = toInputDateFromOffset(-2);
  else if (/ontem/.test(lowered)) date = toInputDateFromOffset(-1);
  else if (/hoje/.test(lowered)) date = todayDate();

  const type = /(sal[aá]rio|recebi|entrada|freela|investimento|dividendo)/.test(lowered) ? 'income' : 'expense';
  const description = raw
    .replace(/r\$\s*[\d.,]+/i, '')
    .replace(/(^|\s)\d+[\d.,]*/g, ' ')
    .replace(/\b(ontem|hoje|anteontem)\b/gi, ' ')
    .trim() || (type === 'income' ? 'Entrada inteligente' : 'Saída inteligente');
  const category = inferCategory(description, type);
  const source = type === 'income' ? 'Conta Corrente' : /visa/.test(lowered) ? 'Cartão Visa' : /master/.test(lowered) ? 'Cartão Mastercard' : 'Conta Corrente';

  return { amount, date, type, description, category, source };
}

function buildSparklinePoints(values) {
  const width = 128;
  const height = 38;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values.map((v, i) => {
    const x = i * step;
    const y = height - ((v / max) * height);
    return `${x},${Math.max(2, Math.min(height - 2, y)).toFixed(2)}`;
  }).join(' ');
}

function computeThreeWeekTrend(transactions, type) {
  const now = new Date(`${todayDate()}T12:00:00`);
  const buckets = [0, 0, 0];
  for (const t of transactions) {
    if (t.type !== type) continue;
    const d = new Date(`${t.date}T12:00:00`);
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays < 0 || diffDays > 20) continue;
    const bucket = 2 - Math.floor(diffDays / 7);
    if (bucket >= 0 && bucket <= 2) buckets[bucket] += t.amount;
  }
  return buckets;
}

function computeDebtStatus(item) {
  const m = monthKey();
  if ((item.paidMonths || []).includes(m)) return 'pago';
  const now = new Date(`${todayDate()}T12:00:00`);
  const due = new Date(now.getFullYear(), now.getMonth(), item.dueDay, 12, 0, 0);
  return now > due ? 'atrasado' : 'pendente';
}

function computeIncomeStatus(item) {
  const m = monthKey();
  if ((item.receivedMonths || []).includes(m)) return 'recebido';
  return 'a-receber';
}

function addMonthsDate(dateStr, months) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) return todayDate();
  const d = new Date(`${dateStr}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function endOfCurrentMonthDate() {
  const now = new Date(`${todayDate()}T12:00:00`);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 12, 0, 0);
  return end.toISOString().split('T')[0];
}

function normalizeMonthList(list) {
  return Array.isArray(list) ? list.filter((m) => /^\d{4}-\d{2}$/.test(String(m))) : [];
}

function getActiveDebtInstallmentAmount(item) {
  const explicit = Number(item?.installmentAmount);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const remaining = Number(item?.remaining) || 0;
  const total = Number(item?.total) || remaining;
  return Math.max(1, Math.min(remaining, Math.round(total / 12)));
}

function inferTotalInstallments(item) {
  const explicit = Number(item?.totalInstallments);
  if (Number.isFinite(explicit) && explicit >= 1) return Math.round(explicit);
  const total = Number(item?.total) || 0;
  const installment = getActiveDebtInstallmentAmount(item);
  if (installment <= 0) return 1;
  return Math.max(1, Math.ceil(total / installment));
}

function inferPaidInstallments(item) {
  const explicit = Number(item?.paidInstallments);
  const totalInstallments = inferTotalInstallments(item);
  if (Number.isFinite(explicit) && explicit >= 0) return Math.min(totalInstallments, Math.round(explicit));

  const paidMonths = normalizeMonthList(item?.paidInstallmentMonths).length;
  if (paidMonths > 0) return Math.min(totalInstallments, paidMonths);

  const remaining = Number(item?.remaining) || 0;
  const installment = getActiveDebtInstallmentAmount(item);
  if (installment <= 0) return 0;
  const remainingInstallments = Math.ceil(Math.max(0, remaining) / installment);
  return Math.max(0, Math.min(totalInstallments, totalInstallments - remainingInstallments));
}

function activeDebtInstallmentStatus(item) {
  const m = monthKey();
  const paidMonths = normalizeMonthList(item?.paidInstallmentMonths);
  if (paidMonths.includes(m)) return 'pago';
  const dueDate = String(item?.nextInstallment || todayDate());
  if (dueDate <= todayDate()) return 'atrasado';
  return 'pendente';
}

function computeActiveDebtStatus(item) {
  const remaining = Number(item?.remaining) || 0;
  if (remaining <= 0) return 'quitado';
  const nextInstallment = String(item?.nextInstallment || todayDate());
  if (nextInstallment <= todayDate()) return 'atrasado';
  return 'em dia';
}

function buildAutoRecurringDebtItems(activeDebts) {
  const monthEnd = endOfCurrentMonthDate();
  return (Array.isArray(activeDebts) ? activeDebts : [])
    .filter((item) => {
      const remaining = Number(item?.remaining) || 0;
      if (remaining <= 0) return false;
      const status = String(item?.status || '').toLowerCase();
      if (status === 'quitado') return false;
      const due = String(item?.nextInstallment || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
      return due <= monthEnd;
    })
    .map((item) => {
      const amount = Math.min(Number(item.remaining) || 0, getActiveDebtInstallmentAmount(item));
      const totalInstallments = inferTotalInstallments(item);
      const paidInstallments = inferPaidInstallments(item);
      const installmentIndex = Math.min(totalInstallments, Math.max(1, paidInstallments + 1));
      return {
        id: `auto-${item.id}`,
        activeDebtId: item.id,
        autoInstallment: true,
        icon: 'receipt-text',
        name: `Parcela: ${item.description}`,
        amount,
        dueDay: Number.parseInt(String(item.nextInstallment).slice(8, 10), 10) || 1,
        status: activeDebtInstallmentStatus(item),
        installmentLabel: `${installmentIndex}/${totalInstallments}`,
      };
    });
}

function applyActiveDebtInstallmentPayment(item, month = monthKey()) {
  const paidMonths = normalizeMonthList(item?.paidInstallmentMonths);
  if (paidMonths.includes(month)) return item;

  const installmentAmount = getActiveDebtInstallmentAmount(item);
  const totalInstallments = inferTotalInstallments(item);
  const paidInstallments = inferPaidInstallments(item);
  const currentRemaining = Number(item?.remaining) || 0;
  const nextRemaining = Math.max(0, currentRemaining - installmentAmount);
  const nextPaidInstallments = Math.min(totalInstallments, paidInstallments + 1);
  return {
    ...item,
    remaining: nextRemaining,
    paidInstallments: nextPaidInstallments,
    totalInstallments,
    paidInstallmentMonths: [...paidMonths, month],
    nextInstallment: nextRemaining > 0 ? addMonthsDate(item.nextInstallment, 1) : item.nextInstallment,
    status: nextRemaining <= 0 ? 'quitado' : 'em dia',
  };
}

function monthsBetween(startMonth, endMonth = monthKey()) {
  if (!/^\d{4}-\d{2}$/.test(String(startMonth || ''))) return 1;
  if (!/^\d{4}-\d{2}$/.test(String(endMonth || ''))) return 1;
  const [startYear, startMonthNumber] = startMonth.split('-').map(Number);
  const [endYear, endMonthNumber] = endMonth.split('-').map(Number);
  const diff = ((endYear - startYear) * 12) + (endMonthNumber - startMonthNumber) + 1;
  return Math.max(1, diff);
}

function computeInvestmentSnapshot(investment) {
  const monthlyContribution = Number(investment?.monthlyContribution) || 0;
  const monthlyRate = (Number(investment?.monthlyRate) || 0) / 100;
  const totalMonths = monthsBetween(investment?.startMonth, monthKey());
  let balance = 0;
  let contributed = 0;

  for (let monthIndex = 0; monthIndex < totalMonths; monthIndex++) {
    balance += monthlyContribution;
    contributed += monthlyContribution;
    balance *= (1 + monthlyRate);
  }

  return {
    contributed,
    balance,
    earnings: Math.max(0, balance - contributed),
    totalMonths,
  };
}

function getFinanceData() {
  const data = store.get('financeiro');
  let shouldPersist = false;

  if (!Array.isArray(data.transactions)) {
    data.transactions = [];
    shouldPersist = true;
  }

  data.transactions = data.transactions.map((t) => {
    const normalized = {
      id: t.id,
      type: t.type === 'income' ? 'income' : 'expense',
      description: t.description || 'Lançamento',
      amount: Number(t.amount) || 0,
      category: t.category || 'Outros',
      date: t.date || todayDate(),
      source: t.source || (t.type === 'income' ? 'Conta Corrente' : 'Conta Corrente'),
      tag: t.tag || '',
      location: t.location || '',
      receipt: t.receipt || '',
    };
    const changed = JSON.stringify(normalized) !== JSON.stringify(t);
    if (changed) shouldPersist = true;
    return normalized;
  });

  if (!Array.isArray(data.recurringDebts)) {
    data.recurringDebts = DEFAULT_RECURRING_DEBTS.map((d) => ({ ...d, paidMonths: [...(d.paidMonths || [])] }));
    shouldPersist = true;
  }

  if (!Array.isArray(data.activeDebts)) {
    data.activeDebts = DEFAULT_ACTIVE_DEBTS.map((d) => ({ ...d }));
    shouldPersist = true;
  }

  data.activeDebts = data.activeDebts.map((item) => {
    const installmentAmount = getActiveDebtInstallmentAmount(item);
    const totalInstallments = inferTotalInstallments({ ...item, installmentAmount });
    const paidInstallments = inferPaidInstallments({ ...item, installmentAmount, totalInstallments });
    const normalized = {
      ...item,
      installmentAmount,
      totalInstallments,
      paidInstallments,
      paidInstallmentMonths: normalizeMonthList(item.paidInstallmentMonths),
      nextInstallment: /^\d{4}-\d{2}-\d{2}$/.test(String(item.nextInstallment || '')) ? item.nextInstallment : todayDate(),
    };
    if (JSON.stringify(normalized) !== JSON.stringify(item)) shouldPersist = true;
    return normalized;
  });

  if (!Array.isArray(data.creditCards)) {
    data.creditCards = DEFAULT_CREDIT_CARDS.map((c) => ({ ...c }));
    shouldPersist = true;
  }

  if (!Array.isArray(data.recurringIncomes)) {
    data.recurringIncomes = DEFAULT_RECURRING_INCOMES.map((i) => ({ ...i, receivedMonths: [...(i.receivedMonths || [])] }));
    shouldPersist = true;
  }

  if (!Array.isArray(data.investments)) {
    const legacyInvestment = data.recurringIncomes.find((item) => /invest/i.test(String(item.name || '')));
    data.investments = legacyInvestment
      ? [{
          id: 1,
          name: legacyInvestment.name || 'Carteira Principal',
          monthlyContribution: Number(legacyInvestment.amount) || 0,
          monthlyRate: 1.2,
          startMonth: monthKey(),
        }]
      : DEFAULT_INVESTMENTS.map((item) => ({ ...item }));
    data.recurringIncomes = data.recurringIncomes.filter((item) => !/invest/i.test(String(item.name || '')));
    shouldPersist = true;
  }

  if (shouldPersist) store.set('financeiro', data);
  return data;
}

function openFinanceDeleteDialog(kind, id, name) {
  _financeDeleteDialog = { kind, id, name, step: 1 };
}

function closeFinanceDeleteDialog() {
  _financeDeleteDialog = null;
}

function runFinanceDelete() {
  if (!_financeDeleteDialog) return;
  const { kind, id } = _financeDeleteDialog;
  store.update('financeiro', (data) => {
    if (kind === 'transaction') {
      data.transactions = (data.transactions || []).filter((item) => item.id !== id);
      return data;
    }
    if (kind === 'recurring-debt') {
      data.recurringDebts = (data.recurringDebts || []).filter((item) => item.id !== id);
      return data;
    }
    if (kind === 'active-debt') {
      data.activeDebts = (data.activeDebts || []).filter((item) => item.id !== id);
      return data;
    }
    if (kind === 'credit-card') {
      data.creditCards = (data.creditCards || []).filter((item) => item.id !== id);
      return data;
    }
    if (kind === 'recurring-income') {
      data.recurringIncomes = (data.recurringIncomes || []).filter((item) => item.id !== id);
      return data;
    }
    return data;
  });

  if (_expandedTransactionId === id) _expandedTransactionId = null;
  if (_editingTransactionId === id) _editingTransactionId = null;
  if (_editingRecurringDebtId === id) _editingRecurringDebtId = null;
  if (_editingActiveDebtId === id) _editingActiveDebtId = null;
  if (_editingCreditCardId === id) _editingCreditCardId = null;
  if (_editingRecurringIncomeId === id) _editingRecurringIncomeId = null;
  if (_statementCardId === id) _statementCardId = null;
  closeFinanceDeleteDialog();
}

function renderFinanceDeleteModal() {
  if (!_financeDeleteDialog) return '';
  const stepTwo = _financeDeleteDialog.step === 2;
  const itemName = escapeHtml(_financeDeleteDialog.name || 'este item');
  return `
    <div class="modal-overlay" data-action="close-finance-delete">
      <div class="modal fin-modal delete-scope-modal" role="dialog" aria-modal="true" aria-labelledby="finance-delete-title">
        <div class="modal-header" style="margin-bottom: 12px;">
          <h3 class="modal-title" id="finance-delete-title">Confirmar exclusão</h3>
        </div>
        <p class="delete-scope-subtitle">
          ${stepTwo ? `Última confirmação para excluir <strong>${itemName}</strong>.` : `Você está prestes a excluir <strong>${itemName}</strong>.`}
        </p>
        <div class="delete-scope-grid">
          <div class="delete-scope-option is-selected">
            <strong>${stepTwo ? 'A ação será permanente' : 'Primeira confirmação'}</strong>
            <span>${stepTwo ? 'Ao continuar, o item será removido do painel financeiro.' : 'Revise antes de prosseguir para a exclusão final.'}</span>
          </div>
        </div>
        <div class="modal-footer" style="margin-top: 14px;">
          <button class="btn btn-secondary" data-action="close-finance-delete">Cancelar</button>
          ${stepTwo
            ? '<button class="btn btn-danger" data-action="confirm-finance-delete">Excluir agora</button>'
            : '<button class="btn btn-primary" data-action="advance-finance-delete">Continuar</button>'}
        </div>
      </div>
    </div>
  `;
}

function renderSparkline(values, cls) {
  const points = buildSparklinePoints(values);
  return `
    <svg viewBox="0 0 128 38" class="fin-sparkline ${cls}" aria-hidden="true">
      <polyline points="${points}" />
    </svg>
  `;
}

function renderSummaryQuartet(data) {
  const monthTransactions = data.transactions.filter((t) => inCurrentMonth(t.date));
  const autoRecurringDebts = buildAutoRecurringDebtItems(data.activeDebts);
  const income = monthTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const pendingRecurringManual = data.recurringDebts.filter((d) => computeDebtStatus(d) !== 'pago').reduce((s, d) => s + d.amount, 0);
  const pendingRecurringAuto = autoRecurringDebts.filter((d) => d.status !== 'pago').reduce((s, d) => s + d.amount, 0);
  const pendingRecurring = pendingRecurringManual + pendingRecurringAuto;
  const availableBalance = income - expense - pendingRecurring;
  const creditTotal = data.creditCards.reduce((s, c) => s + c.limitTotal, 0);
  const creditUsed = data.creditCards.reduce((s, c) => s + c.limitUsed, 0);
  const creditAvailable = Math.max(0, creditTotal - creditUsed);
  const creditPct = creditTotal > 0 ? Math.min(100, Math.round((creditUsed / creditTotal) * 100)) : 0;
  const activeDebtTotal = data.activeDebts.reduce((sum, item) => sum + (Number(item.remaining) || 0), 0);
  const activeDebtCount = data.activeDebts.filter((item) => String(item.status || '').toLowerCase() !== 'quitado').length;
  const investments = Array.isArray(data.investments) ? data.investments : [];
  const investmentSummary = investments.reduce((summary, item) => {
    const snapshot = computeInvestmentSnapshot(item);
    summary.monthlyContribution += Number(item.monthlyContribution) || 0;
    summary.balance += snapshot.balance;
    summary.earnings += snapshot.earnings;
    summary.contributed += snapshot.contributed;
    return summary;
  }, { monthlyContribution: 0, balance: 0, earnings: 0, contributed: 0 });
  const investmentStatus = investmentSummary.earnings > 0 ? 'Em rendimento' : 'A iniciar';
  const investmentPct = investmentSummary.balance > 0
    ? Math.min(100, Math.round((investmentSummary.earnings / investmentSummary.balance) * 100))
    : 0;

  const incomeTrend = computeThreeWeekTrend(monthTransactions, 'income');
  const expenseTrend = computeThreeWeekTrend(monthTransactions, 'expense');

  return `
    <div class="fin-quartet">
      <article class="fin-dashcard income">
        <div class="fin-dash-head"><span>Entradas do Mês</span><i data-lucide="trending-up"></i></div>
        <strong>${fmt(income)}</strong>
        ${renderSparkline(incomeTrend, 'income')}
      </article>
      <article class="fin-dashcard expense">
        <div class="fin-dash-head"><span>Saídas Totais</span><i data-lucide="trending-down"></i></div>
        <strong>${fmt(expense)}</strong>
        ${renderSparkline(expenseTrend, 'expense')}
      </article>
      <article class="fin-dashcard ${availableBalance >= 0 ? 'balance-positive' : 'balance-negative'}">
        <div class="fin-dash-head"><span>Saldo Disponível</span><i data-lucide="wallet"></i></div>
        <strong>${fmt(availableBalance)}</strong>
        <small>Livre de ${fmt(pendingRecurring)} em pendências recorrentes.</small>
      </article>
      <article class="fin-dashcard credit">
        <div class="fin-dash-head"><span>Posição de Crédito</span><i data-lucide="badge-dollar-sign"></i></div>
        <strong>Utilizado: ${fmt(creditUsed)}</strong>
        <small>Disponível: ${fmt(creditAvailable)}</small>
        <div class="fin-credit-track"><div class="fin-credit-fill" style="width:${creditPct}%"></div></div>
      </article>
      <article class="fin-dashcard debt-total ${activeDebtTotal > 0 ? 'debt-total-on' : 'debt-total-off'}">
        <div class="fin-dash-head"><span>Dívida Total Ativa</span><i data-lucide="badge-alert"></i></div>
        <strong>${fmt(activeDebtTotal)}</strong>
        <small>${activeDebtCount} dívida${activeDebtCount !== 1 ? 's' : ''} ativa${activeDebtCount !== 1 ? 's' : ''} em aberto</small>
      </article>
      <article class="fin-dashcard investment ${investmentStatus === 'Em rendimento' ? 'investment-positive' : 'investment-pending'}">
        <div class="fin-dash-head"><span>Status Investimentos</span><i data-lucide="chart-candlestick"></i></div>
        <strong>${fmt(investmentSummary.balance)}</strong>
        <small>${investmentStatus} • Aporte mensal ${fmt(investmentSummary.monthlyContribution)} • Taxa sobre rendimento</small>
        <div class="fin-credit-track"><div class="fin-investment-fill" style="width:${investmentPct}%"></div></div>
      </article>
    </div>
  `;
}

function renderRecurringDebts(data) {
  const editingItem = _editingRecurringDebtId ? data.recurringDebts.find((item) => item.id === _editingRecurringDebtId) : null;
  const autoRecurringDebts = buildAutoRecurringDebtItems(data.activeDebts);
  const recurringRows = [...data.recurringDebts, ...autoRecurringDebts];
  return `
    <section class="fin-panel">
      <div class="fin-panel-header">
        <h4>Dívidas Recorrentes</h4>
        <div class="fin-panel-actions">
          <button class="btn btn-secondary btn-sm" data-action="pay-all-debts"><i data-lucide="check-circle-2"></i> Pagar Tudo</button>
          <button class="btn btn-secondary btn-sm" data-action="new-recurring-debt"><i data-lucide="plus"></i> Adicionar</button>
        </div>
      </div>
      <div class="fin-inline-form">
        <div class="form-row form-row-inline">
          <input type="text" id="recurring-debt-name" class="form-input" placeholder="Nome da conta" value="${escapeHtml(editingItem?.name || '')}" />
          <input type="text" id="recurring-debt-amount" class="form-input" placeholder="Valor (R$)" inputmode="decimal" style="max-width:160px" value="${editingItem ? escapeHtml(fmt(editingItem.amount)) : ''}" />
          <input type="number" id="recurring-debt-day" class="form-input" min="1" max="31" placeholder="Dia" style="max-width:110px" value="${editingItem?.dueDay || ''}" />
          <select id="recurring-debt-icon" class="form-select" style="max-width:160px">
            ${[
              { value: 'droplets', label: 'Água' },
              { value: 'zap', label: 'Luz' },
              { value: 'house', label: 'Casa' },
              { value: 'wifi', label: 'Internet' },
              { value: 'credit-card', label: 'Conta' },
            ].map((icon) => `<option value="${icon.value}" ${editingItem?.icon === icon.value ? 'selected' : ''}>${icon.label}</option>`).join('')}
          </select>
          <button class="btn btn-primary" data-action="save-recurring-debt">${editingItem ? 'Salvar' : 'Adicionar'}</button>
          ${editingItem ? '<button class="btn btn-secondary" data-action="cancel-recurring-debt">Cancelar</button>' : ''}
        </div>
      </div>
      <div class="fin-compact-list">
        ${recurringRows.map((item) => {
          const status = item.autoInstallment ? item.status : computeDebtStatus(item);
          const statusLabel = status === 'pago' ? 'Pago' : status === 'atrasado' ? 'Atrasado' : 'Pendente';
          return `
            <div class="fin-compact-item">
              <div class="fin-compact-main">
                <span class="fin-icon"><i data-lucide="${item.icon}"></i></span>
                <div>
                  <strong>${escapeHtml(item.name)}</strong>
                  <small>Vence dia ${item.dueDay} &middot; ${fmt(item.amount)}${item.autoInstallment ? ` • parcela ${item.installmentLabel}` : ''}</small>
                </div>
              </div>
              <div class="fin-item-actions">
                <span class="fin-status ${status}">${statusLabel}</span>
                ${item.autoInstallment
                  ? `<button class="btn btn-secondary btn-sm" data-action="pay-auto-installment" data-debt-id="${item.activeDebtId}">Pagar parcela</button>`
                  : `<button class="btn-icon" data-action="edit-recurring-debt" data-id="${item.id}"><i data-lucide="pencil"></i></button>
                     <button class="btn-icon danger" data-action="delete-recurring-debt" data-id="${item.id}"><i data-lucide="trash-2"></i></button>`}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderActiveDebts(data) {
  const editingItem = _editingActiveDebtId ? data.activeDebts.find((item) => item.id === _editingActiveDebtId) : null;
  const editingInstallment = Number(editingItem?.installmentAmount) || 0;
  const editingTotalInstallments = Number(editingItem?.totalInstallments) || 0;
  const editingPaidInstallments = editingItem ? inferPaidInstallments(editingItem) : 0;
  const computedTotal = editingInstallment > 0 && editingTotalInstallments > 0
    ? editingInstallment * editingTotalInstallments
    : Number(editingItem?.total) || 0;
  const computedRemaining = editingInstallment > 0 && editingTotalInstallments > 0
    ? Math.max(0, editingInstallment * Math.max(0, editingTotalInstallments - editingPaidInstallments))
    : Number(editingItem?.remaining) || 0;
  return `
    <section class="fin-panel">
      <div class="fin-panel-header">
        <h4>Dívidas Ativas</h4>
        <button class="btn btn-secondary btn-sm" data-action="new-active-debt"><i data-lucide="plus"></i> Adicionar</button>
      </div>
      <div class="fin-inline-form">
        <div class="form-row form-row-inline">
          <input type="text" id="active-debt-description" class="form-input" placeholder="Descrição" value="${escapeHtml(editingItem?.description || '')}" />
          <input type="text" id="active-debt-total" class="form-input" placeholder="Valor total (automático)" inputmode="decimal" readonly style="max-width:190px" value="${editingItem ? escapeHtml(fmt(computedTotal)) : ''}" />
          <input type="text" id="active-debt-remaining" class="form-input" placeholder="Restante (automático)" inputmode="decimal" readonly style="max-width:170px" value="${editingItem ? escapeHtml(fmt(computedRemaining)) : ''}" />
          <input type="text" id="active-debt-installment" class="form-input" placeholder="Parcela mensal" inputmode="decimal" style="max-width:160px" value="${editingItem ? escapeHtml(fmt(editingItem.installmentAmount)) : ''}" />
          <input type="number" id="active-debt-total-installments" class="form-input" min="1" placeholder="Total parcelas" style="max-width:140px" value="${editingItem?.totalInstallments || ''}" />
          <input type="date" id="active-debt-next" class="form-input" style="max-width:180px" value="${editingItem?.nextInstallment || ''}" />
          <span class="fin-status ${editingItem ? computeActiveDebtStatus(editingItem) : 'em dia'}" style="padding: 0.5rem 0.75rem; border-radius: 4px;">${editingItem ? computeActiveDebtStatus(editingItem) : 'em dia'}</span>
          <button class="btn btn-primary" data-action="save-active-debt">${editingItem ? 'Salvar' : 'Adicionar'}</button>
          ${editingItem ? '<button class="btn btn-secondary" data-action="cancel-active-debt">Cancelar</button>' : ''}
        </div>
      </div>
      <div class="fin-table-wrap">
        <table class="fin-table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Valor Total / Restante</th>
              <th>Parcela</th>
              <th>Nº Parcelas</th>
              <th>Próxima Parcela</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.activeDebts.map((d) => `
              <tr>
                <td>${escapeHtml(d.description)}</td>
                <td>${fmt(d.total)} / ${fmt(d.remaining)}</td>
                <td>${fmt(getActiveDebtInstallmentAmount(d))}</td>
                <td>${Math.min(inferPaidInstallments(d) + 1, inferTotalInstallments(d))}/${inferTotalInstallments(d)} <small style="opacity:.8">(pagas ${inferPaidInstallments(d)})</small></td>
                <td>${formatPtDate(d.nextInstallment)}</td>
                <td><span class="fin-status ${computeActiveDebtStatus(d) === 'quitado' ? 'pago' : computeActiveDebtStatus(d) === 'atrasado' ? 'atrasado' : 'pendente'}">${computeActiveDebtStatus(d)}</span></td>
                <td>
                  <div class="fin-table-actions">
                    <button class="btn-icon" data-action="edit-active-debt" data-id="${d.id}"><i data-lucide="pencil"></i></button>
                    <button class="btn-icon danger" data-action="delete-active-debt" data-id="${d.id}"><i data-lucide="trash-2"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function cardBrandIcon(brand) {
  return brand.toLowerCase().includes('master') ? 'circle-gauge' : 'landmark';
}

function renderCreditCards(data) {
  const editingItem = _editingCreditCardId ? data.creditCards.find((item) => item.id === _editingCreditCardId) : null;
  const showForm = _creditCardComposerOpen || !!editingItem;
  return `
    <section class="fin-panel">
      <div class="fin-panel-header">
        <h4>Cartões de Crédito</h4>
        <button class="btn btn-secondary btn-sm" data-action="new-credit-card"><i data-lucide="plus"></i> Adicionar</button>
      </div>
      ${showForm ? `
      <div class="fin-inline-form">
        <div class="form-row form-row-inline">
          <select id="credit-card-brand" class="form-select" style="max-width:160px">
            ${['Visa', 'Mastercard'].map((brand) => `<option value="${brand}" ${editingItem?.brand === brand ? 'selected' : ''}>${brand}</option>`).join('')}
          </select>
          <input type="text" id="credit-card-last4" class="form-input" placeholder="Últimos 4 dígitos" maxlength="4" style="max-width:150px" value="${escapeHtml(editingItem?.last4 || '')}" />
          <input type="number" id="credit-card-closing" class="form-input" min="1" max="31" placeholder="Fechamento" style="max-width:130px" value="${editingItem?.closingDay || ''}" />
          <input type="text" id="credit-card-limit-total" class="form-input" placeholder="Limite total" inputmode="decimal" style="max-width:160px" value="${editingItem ? escapeHtml(fmt(editingItem.limitTotal)) : ''}" />
          <input type="text" id="credit-card-limit-used" class="form-input" placeholder="Utilizado" inputmode="decimal" style="max-width:160px" value="${editingItem ? escapeHtml(fmt(editingItem.limitUsed)) : ''}" />
          <button class="btn btn-primary" data-action="save-credit-card">${editingItem ? 'Salvar' : 'Adicionar'}</button>
          <button class="btn btn-secondary" data-action="cancel-credit-card">Cancelar</button>
        </div>
      </div>` : ''}
      <div class="fin-card-grid">
        <button class="fin-ccard fin-ccard-add" data-action="new-credit-card">
          <span class="fin-ccard-add-icon"><i data-lucide="plus"></i></span>
          <strong>Adicionar novo cartão</strong>
          <small>Cadastre bandeira, final, fechamento e limite.</small>
        </button>
        ${data.creditCards.map((card) => {
          const pct = card.limitTotal > 0 ? Math.min(100, Math.round((card.limitUsed / card.limitTotal) * 100)) : 0;
          return `
            <article class="fin-ccard">
              <div class="fin-ccard-top">
                <div>
                  <span class="fin-ccard-brand">${escapeHtml(card.brand)}</span>
                  <strong>**** ${card.last4}</strong>
                </div>
                <i data-lucide="${cardBrandIcon(card.brand)}"></i>
              </div>
              <small>Fechamento: dia ${card.closingDay}</small>
              <div class="fin-credit-track"><div class="fin-credit-fill" style="width:${pct}%"></div></div>
              <div class="fin-ccard-meta">
                <span>${fmt(card.limitUsed)} / ${fmt(card.limitTotal)}</span>
                <div class="fin-item-actions">
                  <button class="btn btn-secondary btn-sm" data-action="open-statement" data-id="${card.id}">Ver Fatura</button>
                  <button class="btn-icon" data-action="edit-credit-card" data-id="${card.id}"><i data-lucide="pencil"></i></button>
                  <button class="btn-icon danger" data-action="delete-credit-card" data-id="${card.id}"><i data-lucide="trash-2"></i></button>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderRecurringIncomes(data) {
  const editingItem = _editingRecurringIncomeId ? data.recurringIncomes.find((item) => item.id === _editingRecurringIncomeId) : null;
  return `
    <section class="fin-panel">
      <div class="fin-panel-header">
        <h4>Salários e Receitas Recorrentes</h4>
        <button class="btn btn-secondary btn-sm" data-action="new-recurring-income"><i data-lucide="plus"></i> Adicionar</button>
      </div>
      <div class="fin-inline-form">
        <div class="form-row form-row-inline">
          <input type="text" id="recurring-income-name" class="form-input" placeholder="Nome da receita" value="${escapeHtml(editingItem?.name || '')}" />
          <input type="text" id="recurring-income-amount" class="form-input" placeholder="Valor (R$)" inputmode="decimal" style="max-width:160px" value="${editingItem ? escapeHtml(fmt(editingItem.amount)) : ''}" />
          <input type="number" id="recurring-income-day" class="form-input" min="1" max="31" placeholder="Dia" style="max-width:110px" value="${editingItem?.expectedDay || ''}" />
          <select id="recurring-income-icon" class="form-select" style="max-width:180px">
            ${[
              { value: 'briefcase-business', label: 'Salário' },
              { value: 'laptop', label: 'Freelance' },
              { value: 'chart-candlestick', label: 'Investimentos' },
              { value: 'wallet', label: 'Outros' },
            ].map((icon) => `<option value="${icon.value}" ${editingItem?.icon === icon.value ? 'selected' : ''}>${icon.label}</option>`).join('')}
          </select>
          <button class="btn btn-primary" data-action="save-recurring-income">${editingItem ? 'Salvar' : 'Adicionar'}</button>
          ${editingItem ? '<button class="btn btn-secondary" data-action="cancel-recurring-income">Cancelar</button>' : ''}
        </div>
      </div>
      <div class="fin-compact-list">
        ${data.recurringIncomes.map((item) => {
          const status = computeIncomeStatus(item);
          const statusLabel = status === 'recebido' ? 'Recebido' : 'A Receber';
          return `
            <div class="fin-compact-item">
              <div class="fin-compact-main">
                <span class="fin-icon"><i data-lucide="${item.icon}"></i></span>
                <div>
                  <strong>${escapeHtml(item.name)}</strong>
                  <small>Previsto dia ${item.expectedDay} &middot; ${fmt(item.amount)}</small>
                </div>
              </div>
              <div class="fin-item-actions">
                <span class="fin-status ${status === 'recebido' ? 'pago' : 'pendente'}">${statusLabel}</span>
                <button class="btn-icon" data-action="edit-recurring-income" data-id="${item.id}"><i data-lucide="pencil"></i></button>
                <button class="btn-icon danger" data-action="delete-recurring-income" data-id="${item.id}"><i data-lucide="trash-2"></i></button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function matchQuickFilter(t, filter) {
  if (filter === 'all') return true;
  if (filter === 'income') return t.type === 'income';
  if (filter === 'expense') return t.type === 'expense';
  if (filter.startsWith('source:')) return t.source === filter.slice(7);
  return true;
}

function renderTransactionRow(t) {
  const isIncome = t.type === 'income';
  const expanded = _expandedTransactionId === t.id;
  const d = formatPtDate(t.date);
  return `
    <div class="transaction-item ${expanded ? 'is-expanded' : ''}" data-id="${t.id}">
      <button class="transaction-main" data-action="toggle-details" data-id="${t.id}">
        <div class="transaction-icon ${t.type}">
          <i data-lucide="${isIncome ? 'trending-up' : 'trending-down'}"></i>
        </div>
        <div class="transaction-info">
          <span class="transaction-desc">${escapeHtml(t.description)}</span>
          <span class="transaction-meta">${escapeHtml(t.category)} &middot; ${d} &middot; ${escapeHtml(t.source)}</span>
        </div>
        <span class="transaction-amount ${t.type}">${isIncome ? '+' : '-'}${fmt(t.amount)}</span>
      </button>
      <div class="fin-item-actions fin-item-actions-compact">
        <button class="btn-icon" data-action="edit-transaction" data-id="${t.id}"><i data-lucide="pencil"></i></button>
        <button class="btn-icon danger" data-action="delete" data-id="${t.id}"><i data-lucide="trash-2"></i></button>
      </div>
      <div class="transaction-details ${expanded ? 'open' : ''}">
        <div><strong>Tag:</strong> ${escapeHtml(t.tag || 'Sem tag')}</div>
        <div><strong>Local:</strong> ${escapeHtml(t.location || 'Não informado')}</div>
        <div><strong>Anexo:</strong> ${escapeHtml(t.receipt || 'Sem recibo')}</div>
      </div>
    </div>
  `;
}

function groupTransactions(transactions, groupBy) {
  const groups = new Map();
  for (const t of transactions) {
    const key = groupBy === 'category' ? t.category : t.date;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function renderHistory(data) {
  const availableSources = [...new Set(data.transactions.map((t) => t.source).filter((s) => s && s !== 'Conta Corrente'))];
  const sorted = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = sorted.filter((t) => matchQuickFilter(t, _historyFilter));
  const groups = groupTransactions(filtered, _historyGroup);

  return `
    <section class="content-section fin-history">
      <div class="fin-history-top">
        <h3 class="section-label">Histórico de Transações</h3>
        <div class="fin-segmented" role="tablist" aria-label="Agrupar histórico">
          <button class="${_historyGroup === 'day' ? 'active' : ''}" data-action="set-group" data-group="day">Agrupar por Dia</button>
          <button class="${_historyGroup === 'category' ? 'active' : ''}" data-action="set-group" data-group="category">Agrupar por Categoria</button>
        </div>
      </div>

      <div class="fin-quick-filters">
        <button class="${_historyFilter === 'all' ? 'active' : ''}" data-action="set-filter" data-filter="all">Tudo</button>
        <button class="${_historyFilter === 'expense' ? 'active' : ''}" data-action="set-filter" data-filter="expense">Ver apenas Saídas</button>
        <button class="${_historyFilter === 'income' ? 'active' : ''}" data-action="set-filter" data-filter="income">Ver apenas Entradas</button>
        ${availableSources.map((source) => `
          <button class="${_historyFilter === `source:${source}` ? 'active' : ''}" data-action="set-filter" data-filter="source:${escapeHtml(source)}">${escapeHtml(source)}</button>
        `).join('')}
      </div>

      <div class="transaction-list" id="transaction-list">
        ${groups.length ? groups.map(([groupLabel, items]) => `
          <div class="fin-group-block">
            <div class="fin-group-title">${_historyGroup === 'day' ? formatPtDate(groupLabel) : escapeHtml(groupLabel)}</div>
            ${items.map(renderTransactionRow).join('')}
          </div>
        `).join('') : '<p class="empty-state">Nenhuma transação encontrada para os filtros atuais.</p>'}
      </div>
    </section>
  `;
}

function renderSmartFlow(data) {
  return `
    <div class="fin-flow-grid">
      <div class="fin-flow-col">
        ${renderRecurringDebts(data)}
        ${renderActiveDebts(data)}
      </div>
      <div class="fin-flow-col">
        ${renderCreditCards(data)}
        ${renderRecurringIncomes(data)}
      </div>
    </div>
  `;
}

function renderAddTransaction() {
  const categories = _selectedType === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;
  const data = getFinanceData();
  const editingItem = _editingTransactionId ? data.transactions.find((item) => item.id === _editingTransactionId) : null;
  return `
    <section class="add-section fin-add-section">
      <h3 class="form-title">${editingItem ? 'Editar Transação' : 'Nova Transação'}</h3>
      <div class="form-row">
        <div class="fin-segmented type-switch">
          <button class="${_selectedType === 'expense' ? 'active' : ''}" data-action="set-type" data-type="expense"><i data-lucide="trending-down"></i> Saída</button>
          <button class="${_selectedType === 'income' ? 'active' : ''}" data-action="set-type" data-type="income"><i data-lucide="trending-up"></i> Entrada</button>
        </div>
      </div>
      <div class="form-row form-row-inline">
        <input type="text" id="fin-smart" class="form-input" placeholder="Ex: R$50 padaria ontem" />
        <button class="btn btn-secondary" id="fin-parse"><i data-lucide="wand-sparkles"></i> Interpretar</button>
      </div>
      <div class="form-row form-row-inline">
        <input type="text" id="fin-desc" class="form-input" placeholder="Descrição..." value="${escapeHtml(editingItem?.description || '')}" />
        <input type="text" id="fin-amount" class="form-input" placeholder="Valor (R$)" inputmode="decimal" style="max-width:180px" value="${editingItem ? escapeHtml(fmt(editingItem.amount)) : ''}" />
      </div>
      <div class="form-row form-row-inline">
        <select id="fin-category" class="form-select">
          ${categories.map((c) => `<option value="${c}" ${editingItem?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <select id="fin-source" class="form-select" style="max-width:220px">
          ${SOURCES.map((source) => `<option value="${source}" ${editingItem?.source === source ? 'selected' : ''}>${source}</option>`).join('')}
        </select>
        <input type="date" id="fin-date" class="form-input" value="${editingItem?.date || todayDate()}" style="max-width:180px" />
        <input type="text" id="fin-tag" class="form-input" placeholder="Tag" style="max-width:160px" value="${escapeHtml(editingItem?.tag || '')}" />
        <input type="text" id="fin-location" class="form-input" placeholder="Local" style="max-width:180px" value="${escapeHtml(editingItem?.location || '')}" />
        <button class="btn btn-primary" id="fin-add"><i data-lucide="plus"></i> ${editingItem ? 'Salvar' : 'Adicionar'}</button>
        ${editingItem ? '<button class="btn btn-secondary" id="fin-cancel-edit">Cancelar</button>' : ''}
      </div>
    </section>
  `;
}

function renderPayAllModal() {
  if (!_payAllModalOpen) return '';
  return `
    <div class="modal-overlay" data-action="close-pay-all">
      <div class="modal fin-modal" role="dialog" aria-modal="true" aria-labelledby="fin-pay-all-title">
        <div class="modal-header">
          <h3 class="modal-title" id="fin-pay-all-title">Confirmar pagamento em lote</h3>
        </div>
        <p>Deseja marcar todas as dívidas recorrentes deste mês como pagas?</p>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-action="close-pay-all">Cancelar</button>
          <button class="btn btn-primary" data-action="confirm-pay-all">Confirmar pagamento</button>
        </div>
      </div>
    </div>
  `;
}

function renderStatementModal(data) {
  if (!_statementCardId) return '';
  const card = data.creditCards.find((c) => c.id === _statementCardId);
  if (!card) return '';
  const sourceName = `Cartão ${card.brand}`;
  const fatura = data.transactions
    .filter((t) => t.source === sourceName && t.type === 'expense' && inCurrentMonth(t.date))
    .reduce((sum, t) => sum + t.amount, 0);

  return `
    <div class="modal-overlay" data-action="close-statement">
      <div class="modal fin-modal" role="dialog" aria-modal="true" aria-labelledby="fin-statement-title">
        <div class="modal-header">
          <h3 class="modal-title" id="fin-statement-title">Fatura ${escapeHtml(card.brand)} • **** ${card.last4}</h3>
        </div>
        <p>Fechamento no dia ${card.closingDay}. Total de gastos no mês: <strong>${fmt(fatura)}</strong>.</p>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-action="close-statement">Fechar</button>
        </div>
      </div>
    </div>
  `;
}

export function render() {
  const data = getFinanceData();

  return `
    <div class="page-financeiro">
      <div class="page-header">
        <div>
          <h2 class="page-title">Controle Financeiro</h2>
          <p class="page-subtitle">Mês de Abril de 2026 | Visão Geral Dinâmica</p>
        </div>
      </div>

      ${renderSummaryQuartet(data)}

      <section class="content-section fin-intelligent-flow">
        <div class="fin-panel-header">
          <h3 class="section-label" style="margin-bottom:0">Gerenciamento de Fluxo de Caixa Inteligente</h3>
        </div>
        ${renderSmartFlow(data)}
      </section>

      ${renderAddTransaction()}
      ${renderHistory(data)}
      ${renderPayAllModal()}
      ${renderStatementModal(data)}
      ${renderFinanceDeleteModal()}
    </div>
  `;
}

export function init(container) {
  function rerender() {
    container.innerHTML = render();
    refreshIcons();
    init(container);
  }

  function setCategoryOptions() {
    const catSelect = container.querySelector('#fin-category');
    if (!catSelect) return;
    const cats = _selectedType === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;
    catSelect.innerHTML = cats.map((c) => `<option value="${c}">${c}</option>`).join('');
  }

  function applySmartInput() {
    const smartInput = container.querySelector('#fin-smart');
    const parsed = parseSmartInput(smartInput?.value);
    if (!parsed) return;

    _selectedType = parsed.type;
    rerender();

    const descInput = container.querySelector('#fin-desc');
    const amountInput = container.querySelector('#fin-amount');
    const dateInput = container.querySelector('#fin-date');
    const categoryInput = container.querySelector('#fin-category');
    const sourceInput = container.querySelector('#fin-source');
    const smartInputAfter = container.querySelector('#fin-smart');

    if (smartInputAfter) smartInputAfter.value = smartInput?.value || '';
    if (descInput) descInput.value = parsed.description;
    if (amountInput) amountInput.value = formatMoneyInput(parsed.amount);
    if (dateInput) dateInput.value = parsed.date;
    if (categoryInput) categoryInput.value = parsed.category;
    if (sourceInput) sourceInput.value = parsed.source;
  }

  container.querySelectorAll('[data-action="set-type"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _selectedType = btn.dataset.type === 'income' ? 'income' : 'expense';
      rerender();
    });
  });

  container.querySelector('#fin-parse')?.addEventListener('click', () => {
    applySmartInput();
  });

  container.querySelector('#fin-smart')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    applySmartInput();
  });

  container.querySelector('#fin-amount')?.addEventListener('blur', (event) => {
    event.target.value = formatMoneyInput(event.target.value);
  });

  container.querySelector('#fin-add')?.addEventListener('click', () => {
    const desc = container.querySelector('#fin-desc')?.value.trim();
    const amount = parseMoneyInput(container.querySelector('#fin-amount')?.value);
    const category = container.querySelector('#fin-category')?.value;
    const source = container.querySelector('#fin-source')?.value || 'Conta Corrente';
    const date = container.querySelector('#fin-date')?.value;
    const tag = container.querySelector('#fin-tag')?.value.trim() || (_selectedType === 'income' ? 'Receita' : 'Despesa');
    const location = container.querySelector('#fin-location')?.value.trim() || '';

    if (!desc || !amount || amount <= 0 || !date || !category) return;

    store.update('financeiro', (data) => {
      if (!Array.isArray(data.transactions)) data.transactions = [];
      if (_editingTransactionId) {
        data.transactions = data.transactions.map((t) => t.id !== _editingTransactionId ? t : {
          ...t,
          type: _selectedType,
          description: desc,
          amount,
          category,
          source,
          date,
          tag,
          location,
        });
      } else {
        data.transactions.push({
          id: store.nextId(data.transactions),
          type: _selectedType,
          description: desc,
          amount,
          category,
          source,
          date,
          tag,
          location,
          receipt: '',
        });
      }
      return data;
    });
    _expandedTransactionId = null;
    _editingTransactionId = null;
    rerender();
  });

  container.querySelector('#fin-cancel-edit')?.addEventListener('click', () => {
    _editingTransactionId = null;
    _selectedType = 'expense';
    rerender();
  });

  container.querySelectorAll('[data-action="set-group"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _historyGroup = btn.dataset.group === 'category' ? 'category' : 'day';
      rerender();
    });
  });

  container.querySelectorAll('[data-action="set-filter"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _historyFilter = String(btn.dataset.filter || 'all');
      rerender();
    });
  });

  container.querySelectorAll('[data-action="toggle-details"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number.parseInt(btn.dataset.id, 10);
      _expandedTransactionId = _expandedTransactionId === id ? null : id;
      rerender();
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const id = Number.parseInt(btn.dataset.id, 10);
      const item = getFinanceData().transactions.find((t) => t.id === id);
      if (!item) return;
      openFinanceDeleteDialog('transaction', id, item.description);
      rerender();
    });
  });

  container.querySelectorAll('[data-action="close-finance-delete"]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      if (event.currentTarget.classList.contains('modal-overlay') && event.target !== event.currentTarget) return;
      closeFinanceDeleteDialog();
      rerender();
    });
  });

  container.querySelector('[data-action="advance-finance-delete"]')?.addEventListener('click', () => {
    if (!_financeDeleteDialog) return;
    _financeDeleteDialog.step = 2;
    rerender();
  });

  container.querySelector('[data-action="confirm-finance-delete"]')?.addEventListener('click', () => {
    runFinanceDelete();
    rerender();
  });

  container.querySelectorAll('[data-action="edit-transaction"]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const id = Number.parseInt(btn.dataset.id, 10);
      const item = getFinanceData().transactions.find((t) => t.id === id);
      if (!item) return;
      _editingTransactionId = id;
      _selectedType = item.type;
      rerender();
    });
  });

  container.querySelector('[data-action="new-recurring-debt"]')?.addEventListener('click', () => {
    _editingRecurringDebtId = null;
    rerender();
  });

  container.querySelector('[data-action="save-recurring-debt"]')?.addEventListener('click', () => {
    const name = container.querySelector('#recurring-debt-name')?.value.trim();
    const amount = parseMoneyInput(container.querySelector('#recurring-debt-amount')?.value);
    const dueDay = Number.parseInt(container.querySelector('#recurring-debt-day')?.value || '', 10);
    const icon = container.querySelector('#recurring-debt-icon')?.value || 'credit-card';
    if (!name || !amount || !Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) return;

    store.update('financeiro', (data) => {
      if (!Array.isArray(data.recurringDebts)) data.recurringDebts = [];
      if (_editingRecurringDebtId) {
        data.recurringDebts = data.recurringDebts.map((item) => item.id !== _editingRecurringDebtId ? item : {
          ...item,
          name,
          amount,
          dueDay,
          icon,
        });
      } else {
        data.recurringDebts.push({
          id: store.nextId(data.recurringDebts),
          name,
          amount,
          dueDay,
          icon,
          paidMonths: [],
        });
      }
      return data;
    });
    _editingRecurringDebtId = null;
    rerender();
  });

  container.querySelector('[data-action="cancel-recurring-debt"]')?.addEventListener('click', () => {
    _editingRecurringDebtId = null;
    rerender();
  });

  container.querySelectorAll('[data-action="edit-recurring-debt"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _editingRecurringDebtId = Number.parseInt(btn.dataset.id, 10);
      rerender();
    });
  });

  container.querySelectorAll('[data-action="delete-recurring-debt"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number.parseInt(btn.dataset.id, 10);
      const item = getFinanceData().recurringDebts.find((entry) => entry.id === id);
      if (!item) return;
      openFinanceDeleteDialog('recurring-debt', id, item.name);
      rerender();
    });
  });

  container.querySelector('[data-action="new-active-debt"]')?.addEventListener('click', () => {
    _editingActiveDebtId = null;
    rerender();
  });

  container.querySelector('[data-action="save-active-debt"]')?.addEventListener('click', () => {
    const description = container.querySelector('#active-debt-description')?.value.trim();
    const installmentAmount = parseMoneyInput(container.querySelector('#active-debt-installment')?.value);
    const totalInstallmentsRaw = Number.parseInt(container.querySelector('#active-debt-total-installments')?.value || '', 10);
    const nextInstallment = container.querySelector('#active-debt-next')?.value;
    if (!description || !nextInstallment) return;

    const installmentBase = installmentAmount || 0;
    const totalInstallments = Number.isFinite(totalInstallmentsRaw) && totalInstallmentsRaw > 0
      ? totalInstallmentsRaw
      : 0;
    const total = installmentBase * totalInstallments;
    if (!installmentBase || !totalInstallments || !total) return;

    store.update('financeiro', (data) => {
      if (!Array.isArray(data.activeDebts)) data.activeDebts = [];
      if (_editingActiveDebtId) {
        data.activeDebts = data.activeDebts.map((item) => {
          if (item.id !== _editingActiveDebtId) return item;
          const paidInstallments = Math.min(totalInstallments, inferPaidInstallments(item));
          const remaining = Math.max(0, installmentBase * Math.max(0, totalInstallments - paidInstallments));
          const updatedItem = {
            ...item,
            description,
            total,
            remaining,
            installmentAmount: installmentBase,
            totalInstallments,
            paidInstallments,
            nextInstallment,
          };
          return {
            ...updatedItem,
            status: computeActiveDebtStatus(updatedItem),
          };
        });
      } else {
        const newDebt = {
          id: store.nextId(data.activeDebts),
          description,
          total,
          remaining: total,
          installmentAmount: installmentBase,
          totalInstallments,
          paidInstallments: 0,
          nextInstallment,
          paidInstallmentMonths: [],
        };
        data.activeDebts.push({
          ...newDebt,
          status: computeActiveDebtStatus(newDebt),
        });
      }
      return data;
    });
    _editingActiveDebtId = null;
    rerender();
  });

  container.querySelector('[data-action="cancel-active-debt"]')?.addEventListener('click', () => {
    _editingActiveDebtId = null;
    rerender();
  });

  function syncActiveDebtTotalPreview() {
    const installmentInput = container.querySelector('#active-debt-installment');
    const installmentsInput = container.querySelector('#active-debt-total-installments');
    const totalInput = container.querySelector('#active-debt-total');
    const remainingInput = container.querySelector('#active-debt-remaining');
    if (!installmentInput || !installmentsInput || !totalInput || !remainingInput) return;

    const installment = parseMoneyInput(installmentInput.value);
    const installments = Number.parseInt(installmentsInput.value || '', 10);
    if (!installment || !Number.isFinite(installments) || installments <= 0) {
      totalInput.value = '';
      remainingInput.value = '';
      return;
    }
    const paidInstallments = _editingActiveDebtId
      ? inferPaidInstallments(getFinanceData().activeDebts.find((item) => item.id === _editingActiveDebtId))
      : 0;
    const total = installment * installments;
    const remaining = Math.max(0, installment * Math.max(0, installments - paidInstallments));
    totalInput.value = fmt(total);
    remainingInput.value = fmt(remaining);
  }

  container.querySelector('#active-debt-installment')?.addEventListener('input', syncActiveDebtTotalPreview);
  container.querySelector('#active-debt-installment')?.addEventListener('blur', (event) => {
    event.target.value = formatMoneyInput(event.target.value);
    syncActiveDebtTotalPreview();
  });
  container.querySelector('#active-debt-total-installments')?.addEventListener('input', syncActiveDebtTotalPreview);
  syncActiveDebtTotalPreview();

  container.querySelectorAll('[data-action="edit-active-debt"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _editingActiveDebtId = Number.parseInt(btn.dataset.id, 10);
      rerender();
    });
  });

  container.querySelectorAll('[data-action="delete-active-debt"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number.parseInt(btn.dataset.id, 10);
      const item = getFinanceData().activeDebts.find((entry) => entry.id === id);
      if (!item) return;
      openFinanceDeleteDialog('active-debt', id, item.description);
      rerender();
    });
  });

  container.querySelector('[data-action="pay-all-debts"]')?.addEventListener('click', () => {
    _payAllModalOpen = true;
    rerender();
  });

  container.querySelectorAll('[data-action="close-pay-all"]').forEach((el) => {
    el.addEventListener('click', (event) => {
      if (event.currentTarget.dataset.action === 'close-pay-all' && event.target !== event.currentTarget && event.currentTarget.classList.contains('modal-overlay')) return;
      _payAllModalOpen = false;
      rerender();
    });
  });

  container.querySelector('[data-action="confirm-pay-all"]')?.addEventListener('click', () => {
    const m = monthKey();
    store.update('financeiro', (data) => {
      data.recurringDebts = (data.recurringDebts || []).map((d) => ({
        ...d,
        paidMonths: Array.from(new Set([...(d.paidMonths || []), m])),
      }));
      data.activeDebts = (data.activeDebts || []).map((debt) => {
        const due = String(debt.nextInstallment || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return debt;
        if (due > endOfCurrentMonthDate()) return debt;
        return applyActiveDebtInstallmentPayment(debt, m);
      });
      return data;
    });
    _payAllModalOpen = false;
    rerender();
  });

  container.querySelectorAll('[data-action="pay-auto-installment"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const debtId = Number.parseInt(btn.dataset.debtId, 10);
      const m = monthKey();
      store.update('financeiro', (data) => {
        data.activeDebts = (data.activeDebts || []).map((debt) => {
          if (debt.id !== debtId) return debt;
          return applyActiveDebtInstallmentPayment(debt, m);
        });
        return data;
      });
      rerender();
    });
  });

  container.querySelectorAll('[data-action="open-statement"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _statementCardId = Number.parseInt(btn.dataset.id, 10);
      rerender();
    });
  });

  container.querySelectorAll('[data-action="new-credit-card"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _editingCreditCardId = null;
      _creditCardComposerOpen = true;
      rerender();
    });
  });

  container.querySelector('[data-action="save-credit-card"]')?.addEventListener('click', () => {
    const brand = container.querySelector('#credit-card-brand')?.value || 'Visa';
    const last4 = String(container.querySelector('#credit-card-last4')?.value || '').replace(/\D/g, '').slice(-4);
    const closingDay = Number.parseInt(container.querySelector('#credit-card-closing')?.value || '', 10);
    const limitTotal = parseMoneyInput(container.querySelector('#credit-card-limit-total')?.value);
    const limitUsed = parseMoneyInput(container.querySelector('#credit-card-limit-used')?.value);
    if (last4.length !== 4 || !Number.isFinite(closingDay) || closingDay < 1 || closingDay > 31 || !limitTotal) return;

    store.update('financeiro', (data) => {
      if (!Array.isArray(data.creditCards)) data.creditCards = [];
      if (_editingCreditCardId) {
        data.creditCards = data.creditCards.map((item) => item.id !== _editingCreditCardId ? item : {
          ...item,
          brand,
          last4,
          closingDay,
          limitTotal,
          limitUsed,
        });
      } else {
        data.creditCards.push({
          id: store.nextId(data.creditCards),
          brand,
          last4,
          closingDay,
          limitTotal,
          limitUsed,
        });
      }
      return data;
    });
    _editingCreditCardId = null;
    _creditCardComposerOpen = false;
    rerender();
  });

  container.querySelector('[data-action="cancel-credit-card"]')?.addEventListener('click', () => {
    _editingCreditCardId = null;
    _creditCardComposerOpen = false;
    rerender();
  });

  container.querySelectorAll('[data-action="edit-credit-card"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _editingCreditCardId = Number.parseInt(btn.dataset.id, 10);
      _creditCardComposerOpen = true;
      rerender();
    });
  });

  container.querySelectorAll('[data-action="delete-credit-card"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number.parseInt(btn.dataset.id, 10);
      const item = getFinanceData().creditCards.find((entry) => entry.id === id);
      if (!item) return;
      openFinanceDeleteDialog('credit-card', id, `${item.brand} • ${item.last4}`);
      rerender();
    });
  });

  container.querySelector('[data-action="new-recurring-income"]')?.addEventListener('click', () => {
    _editingRecurringIncomeId = null;
    rerender();
  });

  container.querySelector('[data-action="save-recurring-income"]')?.addEventListener('click', () => {
    const name = container.querySelector('#recurring-income-name')?.value.trim();
    const amount = parseMoneyInput(container.querySelector('#recurring-income-amount')?.value);
    const expectedDay = Number.parseInt(container.querySelector('#recurring-income-day')?.value || '', 10);
    const icon = container.querySelector('#recurring-income-icon')?.value || 'wallet';
    if (!name || !amount || !Number.isFinite(expectedDay) || expectedDay < 1 || expectedDay > 31) return;

    store.update('financeiro', (data) => {
      if (!Array.isArray(data.recurringIncomes)) data.recurringIncomes = [];
      if (_editingRecurringIncomeId) {
        data.recurringIncomes = data.recurringIncomes.map((item) => item.id !== _editingRecurringIncomeId ? item : {
          ...item,
          name,
          amount,
          expectedDay,
          icon,
        });
      } else {
        data.recurringIncomes.push({
          id: store.nextId(data.recurringIncomes),
          name,
          amount,
          expectedDay,
          icon,
          receivedMonths: [],
        });
      }
      return data;
    });
    _editingRecurringIncomeId = null;
    rerender();
  });

  container.querySelector('[data-action="cancel-recurring-income"]')?.addEventListener('click', () => {
    _editingRecurringIncomeId = null;
    rerender();
  });

  container.querySelectorAll('[data-action="edit-recurring-income"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _editingRecurringIncomeId = Number.parseInt(btn.dataset.id, 10);
      rerender();
    });
  });

  container.querySelectorAll('[data-action="delete-recurring-income"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number.parseInt(btn.dataset.id, 10);
      const item = getFinanceData().recurringIncomes.find((entry) => entry.id === id);
      if (!item) return;
      openFinanceDeleteDialog('recurring-income', id, item.name);
      rerender();
    });
  });

  container.querySelectorAll('[data-action="close-statement"]').forEach((el) => {
    el.addEventListener('click', (event) => {
      if (event.currentTarget.dataset.action === 'close-statement' && event.target !== event.currentTarget && event.currentTarget.classList.contains('modal-overlay')) return;
      _statementCardId = null;
      rerender();
    });
  });

  setCategoryOptions();
}
