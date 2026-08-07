/* ==========================================================================
   1. DEFAULT CATEGORIES & STATE INITIALIZATION
   ========================================================================== */
const defaultCategories = [
  'EMI & Loans',
  'Shopping',
  'Non-Veg',
  'Vegetable',
  'Grocery',
  'Bills',
  'Travel',
  'Entertainment',
  'Doctor & Medicine',
  'Bike & Services',
  'Personal Care',
  'Food & Dining',
  'Tea & Snacks',
  'Functions & Festival',
  'Others'
];

let initialBudgets = {};
let initialSpent = {};
defaultCategories.forEach(cat => {
  initialBudgets[cat] = 0;
  initialSpent[cat] = 0;
});

let defaultState = {
  income: 0,
  incomesList: [],
  cashSpent: 0,
  ccSpent: 0,
  ccDues: 0,
  highestExpense: { title: 'None', amount: 0 },
  customCategories: [...defaultCategories],
  categoryBudgets: { ...initialBudgets },
  categorySpent: { ...initialSpent },
  expenses: [],
  loans: [],
  archives: []
};

let state = defaultState;

/* Utility: Format date strictly to "Day Month Year" (e.g., "6 August 2026") */
function formatDayMonthYear(dateObj = new Date()) {
  const day = dateObj.getDate();
  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  const month = monthNames[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  return `${day} ${month} ${year}`;
}

/* Utility: Get ISO YYYY-MM-DD string */
function getISODateStr(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseToISO(dateStr) {
  if (!dateStr) return getISODateStr();
  if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
    return dateStr;
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return getISODateStr(parsed);
  }
  return getISODateStr();
}

/* ==========================================================================
   2. LOCAL STORAGE & INITIALIZATION (WITH AUTOMATIC DATA REPAIR)
   ========================================================================== */
function loadState() {
  try {
    const stored = localStorage.getItem('copilot_state');
    if (stored) {
      const parsed = JSON.parse(stored);
      state = Object.assign({}, defaultState, parsed);

      if (!state.archives) state.archives = [];
      if (!state.loans) state.loans = [];

      // DATA REPAIR: Reset loans corrupted where emisPaid was captured as the year (>= 2000)
      state.loans.forEach(loan => {
        let paid = Number(loan.emisPaid) || 0;
        if (paid >= 2000) {
          loan.emisPaid = 0;
          loan.status = 'Active';
        }
      });

      defaultCategories.forEach(cat => {
        if (!state.customCategories.includes(cat)) state.customCategories.push(cat);
        if (state.categoryBudgets[cat] === undefined) state.categoryBudgets[cat] = 0;
        if (state.categorySpent[cat] === undefined) state.categorySpent[cat] = 0;
      });
    }
  } catch (e) {
    state = defaultState;
  }
}

function saveState() {
  try {
    localStorage.setItem('copilot_state', JSON.stringify(state));
  } catch (e) {}
}

function initDates() {
  const el = document.getElementById('currentFullDate');
  if (el) {
    el.innerText = '📅 ' + formatDayMonthYear(new Date());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initDates();
  updateUI();
  populateArchiveDropdown();
});

/* ==========================================================================
   3. UI RENDERING & RECALCULATIONS
   ========================================================================== */
function recalculateSpentTotals() {
  let cash = 0;
  let cc = 0;
  let highest = { title: 'None', amount: 0 };

  state.customCategories.forEach(cat => state.categorySpent[cat] = 0);

  state.expenses.forEach(exp => {
    const amt = Number(exp.amount) || 0;
    if (exp.isCC) {
      cc += amt;
    } else {
      cash += amt;
    }

    if (exp.category && state.categorySpent[exp.category] !== undefined) {
      state.categorySpent[exp.category] += amt;
    }

    if (amt > highest.amount) {
      highest = { title: exp.title, amount: amt };
    }
  });

  state.cashSpent = cash;
  state.ccSpent = cc;
  state.highestExpense = highest;
}

function updateUI() {
  recalculateSpentTotals();

  const cash = Number(state.cashSpent) || 0;
  const cc = Number(state.ccSpent) || 0;
  const inc = Number(state.income) || 0;
  const dues = Number(state.ccDues) || 0;

  const totalSpent = cash + cc;
  const moneyLeft = inc - cash;
  const savingsPct = inc > 0 ? Math.max(0, Math.round((moneyLeft / inc) * 100)) : 0;

  const setTxt = (id, txt) => {
    const node = document.getElementById(id);
    if (node) node.innerText = txt;
  };

  setTxt('dispIncome', `₹${inc.toLocaleString()}`);
  setTxt('dispSpent', `₹${totalSpent.toLocaleString()}`);
  setTxt('dispMoneyLeft', `₹${moneyLeft.toLocaleString()}`);
  setTxt('dispSavings', `${savingsPct}%`);
  setTxt('dispHighest', state.highestExpense && state.highestExpense.amount > 0 
    ? `${state.highestExpense.title} (₹${state.highestExpense.amount.toLocaleString()})` 
    : 'None');
  setTxt('dispCCDues', `₹${dues.toLocaleString()}`);

  populateCategoryDropdowns();
  renderUpcomingEmiAlert();
  renderCategoryStatus();
  renderExpensesList();
  renderLoans();
  saveState();
}

function populateCategoryDropdowns() {
  const catEl = document.getElementById('expCategory');
  const filterEl = document.getElementById('expenseFilterSelect');

  if (catEl) {
    const currentVal = catEl.value;
    catEl.innerHTML = '';
    state.customCategories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      catEl.appendChild(opt);
    });
    if (state.customCategories.includes(currentVal)) catEl.value = currentVal;
  }

  if (filterEl) {
    const currentFilter = filterEl.value;
    filterEl.innerHTML = '<option value="All">All Categories</option><option value="Income">💰 Income Only</option>';
    state.customCategories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      filterEl.appendChild(opt);
    });
    filterEl.value = currentFilter || 'All';
  }
}

/* ==========================================================================
   4. PROMINENT UPCOMING EMI NOTIFICATION & BADGE LOGIC
   ========================================================================== */
function renderUpcomingEmiAlert() {
  const listContainer = document.getElementById('upcomingEmiList');
  let badgeElement = document.getElementById('emiBadge') || document.querySelector('.notification-badge');
  const cardContainer = listContainer ? (listContainer.closest('.card') || listContainer.parentElement) : null;

  if (!badgeElement && listContainer) {
    const header = listContainer.parentElement.querySelector('h2, h3, .card-title, header');
    if (header) {
      badgeElement = document.createElement('span');
      badgeElement.id = 'emiBadge';
      badgeElement.style.cssText = 'background:#ef4444; color:#ffffff; font-size:12px; font-weight:bold; padding:2px 8px; border-radius:12px; margin-left:8px; display:inline-block;';
      header.appendChild(badgeElement);
    }
  }

  const activeLoans = (state.loans || []).filter(loan => {
    const totalEmis = Number(loan.totalEmis) || 1;
    const emisPaid = Number(loan.emisPaid) || 0;
    const remainingEmis = Math.max(0, totalEmis - emisPaid);
    
    return loan.status !== 'Completed' && !loan.isPaidThisMonth && remainingEmis > 0;
  });

  if (activeLoans.length === 0) {
    if (listContainer) listContainer.innerHTML = '';
    if (cardContainer) cardContainer.style.display = 'none';
    
    if (badgeElement) {
      badgeElement.innerText = '0';
      badgeElement.style.display = 'none';
    }
    return;
  }

  if (cardContainer) cardContainer.style.display = 'block';
  if (badgeElement) {
    badgeElement.innerText = activeLoans.length;
    badgeElement.style.display = 'inline-block';
  }

  if (listContainer) {
    listContainer.innerHTML = '';
    activeLoans.forEach(loan => {
      const emiAmt = Number(loan.emiAmount) || 0;
      const div = document.createElement('div');
      div.style.padding = '4px 0';
      div.innerHTML = `• <strong>${loan.name}</strong>: ₹${emiAmt.toLocaleString()} EMI due on <strong>${loan.dueDate || 'N/A'}</strong> (${loan.bank || 'Bank'})`;
      listContainer.appendChild(div);
    });
  }
}

/* ==========================================================================
   5. AUTOMATIC CATEGORY KEYWORD SELECTION
   ========================================================================== */
function autoSelectCategory() {
  const inputEl = document.getElementById('expTitle');
  const catEl = document.getElementById('expCategory');
  if (!inputEl || !catEl) return;

  const title = inputEl.value.toLowerCase().trim();
  if (!title) {
    catEl.value = 'Others';
    return;
  }

  const keywordMap = {
    'EMI & Loans': ['emi', 'loan', 'interest', 'creditor'],
    'Shopping': ['shopping', 'dress', 'shirt', 'pant', 'shoes', 'amazon', 'flipkart', 'myntra', 'clothes'],
    'Non-Veg': ['chicken', 'mutton', 'fish', 'egg', 'prawn', 'meat'],
    'Vegetable': ['vegetable', 'veggie', 'tomato', 'onion', 'potato', 'sabzi'],
    'Grocery': ['grocery', 'dmart', 'rice', 'oil', 'dal', 'milk', 'atta', 'store'],
    'Bills': ['bill', 'electricity', 'current', 'wifi', 'internet', 'water', 'rent'],
    'Travel': ['petrol', 'diesel', 'fuel', 'auto', 'cab', 'uber', 'ola', 'bus', 'train', 'flight', 'toll'],
    'Entertainment': ['movie', 'cinema', 'netflix', 'prime', 'hotstar', 'game', 'show'],
    'Doctor & Medicine': ['doctor', 'medicine', 'hospital', 'clinic', 'pharma', 'tablet', 'health'],
    'Bike & Services': ['bike', 'service', 'mechanic', 'repair', 'car', 'wash', 'tyre'],
    'Personal Care': ['salon', 'haircut', 'spa', 'barber', 'soap', 'shampoo'],
    'Food & Dining': ['food', 'hotel', 'restaurant', 'zomato', 'swiggy', 'dinner', 'lunch', 'biryani'],
    'Tea & Snacks': ['tea', 'chai', 'coffee', 'snacks', 'biscuit', 'bakery', 'samosa'],
    'Functions & Festival': ['gift', 'function', 'festival', 'pooja', 'marriage', 'birthday', 'party']
  };

  let foundCategory = null;
  for (const [category, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(k => title.includes(k))) {
      foundCategory = category;
      break;
    }
  }

  catEl.value = foundCategory || 'Others';
}

/* ==========================================================================
   6. AUTOMATED MONTHLY ARCHIVE & BUDGET RESET LOGIC
   ========================================================================== */
function executeAutomatedReset(keepExistingBudget = true) {
  if (state.expenses.length > 0 || state.incomesList.length > 0) {
    const archiveRecord = {
      id: Date.now().toString(),
      monthTitle: formatDayMonthYear(new Date()),
      income: state.income,
      incomesList: [...state.incomesList],
      expenses: [...state.expenses],
      categoryBudgets: { ...state.categoryBudgets },
      totalSpent: state.cashSpent + state.ccSpent
    };

    state.archives.unshift(archiveRecord);
  }

  state.income = 0;
  state.incomesList = [];
  state.expenses = [];
  state.cashSpent = 0;
  state.ccSpent = 0;
  state.ccDues = 0;
  state.highestExpense = { title: 'None', amount: 0 };
  
  if (state.loans) {
    state.loans.forEach(loan => loan.isPaidThisMonth = false);
  }

  state.customCategories.forEach(cat => {
    state.categorySpent[cat] = 0;
  });

  if (!keepExistingBudget) {
    openCreateBudgetModal();
  } else {
    updateUI();
    populateArchiveDropdown();
  }
}

function useLastMonthBudget(e) {
  if (e && e.preventDefault) e.preventDefault();
  executeAutomatedReset(true);
}

function openCreateBudgetModal() {
  const container = document.getElementById('categoryInputsContainer');
  if (!container) return;
  container.innerHTML = '';

  state.customCategories.forEach(cat => {
    const currentTarget = state.categoryBudgets[cat] || 0;
    const row = document.createElement('div');
    row.className = 'category-input-row';
    row.innerHTML = `
      <label>${cat}:</label>
      <input type="number" data-cat="${cat}" value="${currentTarget}" placeholder="₹ 0" />
    `;
    container.appendChild(row);
  });

  document.getElementById('budgetModalOverlay')?.classList.add('active');
}

function closeCreateBudgetModal() {
  document.getElementById('budgetModalOverlay')?.classList.remove('active');
}

function saveCategoryTargets() {
  const inputs = document.querySelectorAll('#categoryInputsContainer input');
  inputs.forEach(input => {
    const cat = input.getAttribute('data-cat');
    const val = parseFloat(input.value) || 0;
    state.categoryBudgets[cat] = Math.max(0, val);
  });

  closeCreateBudgetModal();
  updateUI();
  populateArchiveDropdown();
}

/* ==========================================================================
   7. DRAWER ARCHIVES TAB & CATEGORY STATUS
   ========================================================================== */
function populateArchiveDropdown() {
  const select = document.getElementById('archiveSelect');
  if (!select) return;
  select.innerHTML = '<option value="">-- Select Archived Month --</option>';

  state.archives.forEach(arch => {
    const opt = document.createElement('option');
    opt.value = arch.id;
    opt.textContent = `${arch.monthTitle} (${arch.expenses.length + arch.incomesList.length} records)`;
    select.appendChild(opt);
  });
}

function renderArchivedMonthDetails() {
  const id = document.getElementById('archiveSelect')?.value;
  const container = document.getElementById('archiveMonthContent');
  if (!container) return;
  container.innerHTML = '';

  if (!id) {
    container.innerHTML = '<p class="subtext">Select an archived month above to view past records.</p>';
    return;
  }

  const arch = state.archives.find(a => a.id === id);
  if (!arch) return;

  container.innerHTML = `
    <div class="category-card">
      <div style="font-weight:bold; margin-bottom:4px;">Snapshot Summary (${arch.monthTitle})</div>
      <div>Income: ₹${arch.income.toLocaleString()}</div>
      <div>Total Spent: ₹${arch.totalSpent.toLocaleString()}</div>
      <div>Logged Transactions: ${arch.expenses.length} expenses, ${arch.incomesList.length} incomes</div>
    </div>
  `;
}

function renderCategoryStatus() {
  const container = document.getElementById('categoryStatusList');
  if (!container) return;
  container.innerHTML = '';

  state.customCategories.forEach(cat => {
    const target = state.categoryBudgets[cat] || 0;
    const spent = state.categorySpent[cat] || 0;
    const pct = target > 0 ? Math.min(100, Math.round((spent / target) * 100)) : 0;

    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:14px;">
        <span>${cat}</span>
        <span>₹${spent.toLocaleString()} / ₹${target.toLocaleString()}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${pct}%; background:${pct >= 100 ? '#ef4444' : 'var(--primary-orange)'};"></div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-gray);">
        <span>${pct}% Target Used</span>
        <button class="edit-btn" type="button" onclick="editSingleCategoryTarget('${cat}')">✏️ Edit</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function editSingleCategoryTarget(cat) {
  const current = state.categoryBudgets[cat] || 0;
  const newTargetStr = prompt(`Set budget target for ${cat} (₹):`, current);
  if (newTargetStr === null) return;

  const val = parseFloat(newTargetStr);
  if (isNaN(val) || val < 0) return alert("Invalid amount");

  state.categoryBudgets[cat] = val;
  updateUI();
}

/* ==========================================================================
   8. TRANSACTION HISTORY & DATE FILTERING
   ========================================================================== */
function isDateInFilter(isoDateStr, filterType) {
  if (filterType === 'all') return true;

  const todayIso = getISODateStr();
  const itemIso = parseToISO(isoDateStr);

  if (filterType === 'today') {
    return itemIso === todayIso;
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  const itemDate = new Date(itemIso);
  itemDate.setHours(0,0,0,0);

  if (filterType === 'week') {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23,59,59,999);

    return itemDate >= startOfWeek && itemDate <= endOfWeek;
  }

  if (filterType === 'month') {
    return itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear();
  }

  if (filterType === 'custom') {
    const startVal = document.getElementById('customStartDate')?.value;
    const endVal = document.getElementById('customEndDate')?.value;
    if (!startVal || !endVal) return true;

    const start = new Date(startVal);
    start.setHours(0,0,0,0);
    const end = new Date(endVal);
    end.setHours(23,59,59,999);

    return itemDate >= start && itemDate <= end;
  }

  return true;
}

function handleTimeFilterChange() {
  const val = document.getElementById('timeFilterSelect')?.value;
  const container = document.getElementById('customDateRangeContainer');
  if (container) container.style.display = (val === 'custom') ? 'flex' : 'none';
  renderExpensesList();
}

function renderExpensesList() {
  const container = document.getElementById('expenseList');
  if (!container) return;
  container.innerHTML = '';

  const catFilterVal = document.getElementById('expenseFilterSelect')?.value || 'All';
  const timeFilterVal = document.getElementById('timeFilterSelect')?.value || 'all';

  const expList = (state.expenses || []).map(e => ({ ...e, type: 'expense' }));
  const incList = (state.incomesList || []).map(i => ({
    id: i.id || Date.now(),
    title: `💰 ${i.name}`,
    amount: i.amount,
    category: 'Income',
    isCC: false,
    isoDate: i.isoDate || getISODateStr(),
    displayDate: i.displayDate || formatDayMonthYear(),
    type: 'income'
  }));

  const allTx = [...expList, ...incList].sort((a, b) => b.id - a.id);

  const filtered = allTx.filter(item => {
    const matchesCategory = (catFilterVal === 'All') 
      ? true 
      : (catFilterVal === 'Income' ? item.type === 'income' : item.category === catFilterVal);

    const matchesTime = isDateInFilter(item.isoDate, timeFilterVal);
    return matchesCategory && matchesTime;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p class="subtext" style="text-align:center; padding: 12px;">No matching transactions found.</p>';
    return;
  }

  filtered.forEach(item => {
    const isInc = item.type === 'income';
    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-weight:bold;">
        <span>${item.title} ${item.isCC ? '💳' : ''}</span>
        <span style="color:${isInc ? '#10b981' : '#ef4444'};">${isInc ? '+' : '-'}₹${item.amount.toLocaleString()}</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; color:var(--text-gray); margin-top:6px;">
        <span>${item.displayDate || formatDayMonthYear()} | ${isInc ? 'Income' : item.category}</span>
        <div class="card-actions">
          <button class="edit-btn" onclick="${isInc ? `editIncome(${item.id})` : `editExpense(${item.id})`}">✏️ Edit</button>
          <button class="delete-btn" onclick="${isInc ? `deleteIncome(${item.id})` : `deleteExpense(${item.id})`}">🗑️ Delete</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function editExpense(id) {
  const exp = state.expenses.find(e => e.id === id);
  if (!exp) return;

  const newTitle = prompt("Edit expense title:", exp.title);
  if (newTitle === null) return;

  const newAmountStr = prompt("Edit amount (₹):", exp.amount);
  if (newAmountStr === null) return;
  const newAmount = parseFloat(newAmountStr);

  if (!newTitle.trim() || isNaN(newAmount) || newAmount <= 0) {
    return alert("Invalid title or amount entered.");
  }

  exp.title = newTitle.trim();
  exp.amount = newAmount;
  exp.isCC = exp.title.toLowerCase().includes('cc') || exp.title.toLowerCase().includes('credit card');

  updateUI();
}

function editIncome(id) {
  const inc = state.incomesList.find(i => i.id === id);
  if (!inc) return;

  const newName = prompt("Edit income source name:", inc.name);
  if (newName === null) return;

  const newAmountStr = prompt("Edit amount (₹):", inc.amount);
  if (newAmountStr === null) return;
  const newAmount = parseFloat(newAmountStr);

  if (!newName.trim() || isNaN(newAmount) || newAmount <= 0) {
    return alert("Invalid name or amount entered.");
  }

  const diff = newAmount - inc.amount;
  inc.name = newName.trim();
  inc.amount = newAmount;
  state.income += diff;

  updateUI();
}

/* ==========================================================================
   9. LOGGING HANDLERS
   ========================================================================== */
function addIncome() {
  const srcEl = document.getElementById('incomeSource');
  const valEl = document.getElementById('incomeInput');

  const source = srcEl.value.trim() || "General Income";
  const val = parseFloat(valEl.value);

  if (isNaN(val) || val <= 0) return alert("Enter a valid income amount.");

  state.income += val;
  state.incomesList.push({
    id: Date.now(),
    name: source,
    amount: val,
    isoDate: getISODateStr(),
    displayDate: formatDayMonthYear()
  });

  srcEl.value = '';
  valEl.value = '';
  updateUI();
}

function logExpense() {
  const titleEl = document.getElementById('expTitle');
  const amtEl = document.getElementById('expAmount');
  const catEl = document.getElementById('expCategory');

  const title = titleEl.value.trim();
  const amount = parseFloat(amtEl.value);
  const category = catEl.value || 'Others';

  if (!title || isNaN(amount) || amount <= 0) return alert("Enter a valid title and amount.");

  const isCC = title.toLowerCase().includes('cc') || title.toLowerCase().includes('credit card');

  if (isCC) {
    state.ccDues += amount;
  }

  state.expenses.unshift({
    id: Date.now(),
    title: title,
    amount: amount,
    category: category,
    isCC: isCC,
    isoDate: getISODateStr(),
    displayDate: formatDayMonthYear()
  });

  titleEl.value = '';
  amtEl.value = '';
  updateUI();
}

function deleteExpense(id) {
  const idx = state.expenses.findIndex(e => e.id === id);
  if (idx !== -1) {
    const exp = state.expenses[idx];
    if (exp.isCC) {
      state.ccDues = Math.max(0, state.ccDues - exp.amount);
    }
    state.expenses.splice(idx, 1);
    updateUI();
  }
}

function deleteIncome(id) {
  const idx = state.incomesList.findIndex(i => i.id === id);
  if (idx !== -1) {
    state.income = Math.max(0, state.income - state.incomesList[idx].amount);
    state.incomesList.splice(idx, 1);
    updateUI();
  }
}

function payCCBill() {
  const valEl = document.getElementById('ccPayoffAmount');
  const val = parseFloat(valEl.value);
  if (isNaN(val) || val <= 0) return alert("Enter a valid payoff amount");

  state.ccDues = Math.max(0, state.ccDues - val);
  state.expenses.unshift({
    id: Date.now(),
    title: "💳 CC Bill Payoff",
    amount: val,
    category: "Bills",
    isCC: false,
    isoDate: getISODateStr(),
    displayDate: formatDayMonthYear()
  });

  valEl.value = '';
  updateUI();
}

/* ==========================================================================
   10. CREDITORS & ACTIVE PORTFOLIO LOANS (STRICT SANITIZED INPUTS)
   ========================================================================== */
function renderLoans() {
  const container = document.getElementById('loanList');
  if (!container) return;
  container.innerHTML = '';

  if (!state.loans || state.loans.length === 0) {
    container.innerHTML = '<p class="subtext">No creditors or loans logged.</p>';
    return;
  }

  state.loans.forEach(loan => {
    const emiAmount = Number(loan.emiAmount) || 0;
    const totalEmis = Math.max(1, Number(loan.totalEmis) || 1);
    const emisPaid = Number(loan.emisPaid) || 0;

    const totalAmount = emiAmount * totalEmis;
    const remainingEmis = Math.max(0, totalEmis - emisPaid);
    const remainingBalance = remainingEmis * emiAmount;
    const isCompleted = remainingEmis === 0 || loan.status === 'Completed';

    const div = document.createElement('div');
    div.className = 'history-card';

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-weight:bold;">
        <span>${loan.name} (${loan.bank || 'Bank'})</span>
        <span style="color:${isCompleted ? '#10b981' : 'var(--danger)'}">
          ${isCompleted ? 'Settled / Completed' : `Bal: ₹${remainingBalance.toLocaleString()}`}
        </span>
      </div>
      <div style="font-size:12px; color:var(--text-gray); margin-top:4px;">
        Monthly EMI: ₹${emiAmount.toLocaleString()} | EMIs Paid: ${emisPaid}/${totalEmis} | Due: ${loan.dueDate || 'N/A'}
      </div>
      <div style="font-size:11px; color:var(--text-gray); margin-top:2px;">
        Total Loan Amount: ₹${totalAmount.toLocaleString()}
      </div>
      <div style="margin-top:8px; display:flex; gap:8px;">
        ${!isCompleted ? `
          <button class="edit-btn pay-emi-btn" 
                  style="background:${loan.isPaidThisMonth ? '#9ca3af' : 'var(--primary-orange)'}; color:#fff;" 
                  data-id="${loan.id}" 
                  ${loan.isPaidThisMonth ? 'disabled' : ''}>
            ${loan.isPaidThisMonth ? '✓ Paid This Month' : 'Mark as Paid'}
          </button>
        ` : ''}
        <button class="delete-btn delete-loan-btn" data-id="${loan.id}">🗑️ Remove</button>
      </div>
    `;

    const payBtn = div.querySelector('.pay-emi-btn');
    if (payBtn) {
      payBtn.addEventListener('click', () => payEmi(loan.id));
    }

    const deleteBtn = div.querySelector('.delete-loan-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => deleteCreditor(loan.id));
    }

    container.appendChild(div);
  });
}

function addCreditor() {
  const tab = document.getElementById('creditorsTab');
  const allInputs = tab ? tab.querySelectorAll('input') : document.querySelectorAll('#creditorsTab input');

  // Explicit ID fetch with fallback index checking
  const nameEl = document.getElementById('creditorName') || allInputs[0];
  const emiEl = document.getElementById('creditorEmi') || allInputs[1];
  const totalEmisEl = document.getElementById('creditorTotalEmis') || allInputs[2];
  const emisPaidEl = document.getElementById('creditorEmisPaid') || allInputs[3];
  const bankEl = document.getElementById('creditorBank') || allInputs[4];

  const name = nameEl ? nameEl.value.trim() : '';
  const emiVal = parseFloat(emiEl ? emiEl.value : 0) || 0;
  
  const rawTotal = parseInt(totalEmisEl ? totalEmisEl.value : 1);
  const totalEmis = isNaN(rawTotal) || rawTotal < 1 ? 1 : rawTotal;
  
  // Guard against string dates (e.g., "2026-08-06") parsing into 2026
  let rawPaid = parseInt(emisPaidEl ? emisPaidEl.value : 0);
  if (isNaN(rawPaid) || rawPaid < 0 || rawPaid >= 2000) {
    rawPaid = 0; // Reset invalid or date-parsed numbers back to 0
  }
  const emisPaid = rawPaid;

  const bank = bankEl ? bankEl.value.trim() : 'Bank';

  if (!name || emiVal <= 0) return alert("Please enter Creditor Name and a valid Monthly EMI Amount.");

  const isCompleted = emisPaid >= totalEmis;

  state.loans.push({
    id: Date.now().toString(),
    name: name,
    emiAmount: emiVal,
    totalEmis: totalEmis,
    emisPaid: emisPaid,
    status: isCompleted ? 'Completed' : 'Active',
    isPaidThisMonth: false,
    dueDate: formatDayMonthYear(new Date()),
    bank: bank || 'Bank'
  });

  // Clear input fields
  if (nameEl) nameEl.value = '';
  if (emiEl) emiEl.value = '';
  if (totalEmisEl) totalEmisEl.value = '';
  if (emisPaidEl) emisPaidEl.value = '';
  if (bankEl) bankEl.value = '';

  updateUI();
}

function payEmi(loanId) {
  if (!state.loans) return;

  const loan = state.loans.find(l => String(l.id) === String(loanId));
  if (!loan || loan.status === 'Completed' || loan.isPaidThisMonth) return;

  loan.emisPaid = (Number(loan.emisPaid) || 0) + 1;
  loan.isPaidThisMonth = true;

  if (loan.emisPaid >= loan.totalEmis) {
    loan.status = 'Completed';
  }

  state.expenses.unshift({
    id: Date.now(),
    title: `🏦 EMI: ${loan.name}`,
    amount: Number(loan.emiAmount) || 0,
    category: 'EMI & Loans',
    isCC: false,
    isoDate: getISODateStr(),
    displayDate: formatDayMonthYear()
  });

  updateUI();
}

function deleteCreditor(id) {
  state.loans = state.loans.filter(l => String(l.id) !== String(id));
  updateUI();
}

/* ==========================================================================
   11. DRAWER CONTROLS & EXPORT/IMPORT
   ========================================================================== */
function toggleDrawer() {
  document.getElementById('sideDrawer')?.classList.toggle('active');
  document.getElementById('drawerOverlay')?.classList.toggle('active');
}

function switchDrawerTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  document.getElementById(tabId)?.classList.add('active');

  if (tabId === 'statusTab') document.getElementById('tabBtnStatus')?.classList.add('active');
  if (tabId === 'historyTab') document.getElementById('tabBtnHistory')?.classList.add('active');
  if (tabId === 'archivesTab') {
    document.getElementById('tabBtnArchives')?.classList.add('active');
    populateArchiveDropdown();
  }
  if (tabId === 'creditorsTab') document.getElementById('tabBtnCreditors')?.classList.add('active');
}

function exportExcel() {
  let csvContent = "data:text/csv;charset=utf-8,Date,Title,Category,Type,Amount (INR)\n";

  state.incomesList.forEach(i => {
    csvContent += `"${i.displayDate || formatDayMonthYear()}","${i.name}","Income","INCOME",${i.amount}\n`;
  });

  state.expenses.forEach(e => {
    csvContent += `"${e.displayDate || formatDayMonthYear()}","${e.title}","${e.category}","EXPENSE",${e.amount}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Financial_Copilot_${formatDayMonthYear(new Date()).replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
  const link = document.createElement("a");
  link.setAttribute("href", dataStr);
  link.setAttribute("download", `Copilot_Backup_${formatDayMonthYear(new Date()).replace(/\s+/g, '_')}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported) {
        state = Object.assign({}, defaultState, imported);
        updateUI();
        populateArchiveDropdown();
      }
    } catch (err) {
      alert("Invalid JSON file provided.");
    }
  };
  reader.readAsText(file);
}
