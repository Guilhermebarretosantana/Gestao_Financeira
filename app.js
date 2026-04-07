// app.js
// Lógica da aplicação Finance Control
// - Transações guardadas em localStorage
// - Atualiza saldo, resumo e gráfico (Chart.js)
// - Formulário para adicionar receitas/despesas

// =========================
// Helpers e inicialização
const STORAGE_KEY = 'mf_transactions_v1';

const $ = sel => document.querySelector(sel);
const qs = sel => document.querySelectorAll(sel);

const formatCurrency = (value) => {
  // Formata para R$ com locale pt-BR
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Paleta por categoria (cores para o gráfico e avatar)
const CATEGORY_COLORS = {
  'Alimentação': '#6c5ce7',
  'Transporte': '#4dabf7',
  'Lazer': '#ff7675',
  'Contas': '#00b894',
  'Outros': '#a29bfe'
};

// Recupera transações do localStorage ou inicializa com alguns exemplos
function loadTransactions(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw){
    const seed = [
      {id:cryptoRandomId(), name:'Salário', category:'Contas', amount:4200.00, type:'income', date:Date.now()},
      {id:cryptoRandomId(), name:'Almoço', category:'Alimentação', amount:45.20, type:'expense', date:Date.now()},
      {id:cryptoRandomId(), name:'Uber', category:'Transporte', amount:32.50, type:'expense', date:Date.now()},
      {id:cryptoRandomId(), name:'Cinema', category:'Lazer', amount:28.00, type:'expense', date:Date.now()}
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  try{ return JSON.parse(raw) } catch(e){ return [] }
}

function saveTransactions(list){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function cryptoRandomId(){
  return Math.random().toString(36).slice(2,9);
}

// =========================
// Estado
let transactions = loadTransactions();
let chart = null;

// =========================
// Cálculos e render
function calculateTotals(list){
  const income = list.filter(t=>t.type==='income').reduce((s,t)=>s + Number(t.amount),0);
  const expense = list.filter(t=>t.type==='expense').reduce((s,t)=>s + Number(t.amount),0);
  return { income, expense, balance: income - expense };
}

function categoryTotals(list){
  const totals = {};
  list.filter(t=>t.type==='expense').forEach(t=>{
    totals[t.category] = (totals[t.category]||0) + Number(t.amount);
  })
  return totals;
}

function renderSummary(){
  const {income, expense, balance} = calculateTotals(transactions);
  $('#totalIncome').textContent = formatCurrency(income);
  $('#totalExpense').textContent = formatCurrency(expense);
  $('#totalSavings').textContent = formatCurrency(Math.max(0, balance));
  $('#balance').textContent = formatCurrency(balance);
}

function renderList(filterCategory=null, searchTerm=''){
  const listEl = $('#transactionsList');
  listEl.innerHTML = '';
  const filtered = transactions.filter(t=>{
    if(filterCategory && filterCategory !== 'all'){
      if(t.category !== filterCategory) return false;
    }
    if(searchTerm){
      return t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  }).sort((a,b)=>b.date - a.date);

  if(filtered.length === 0){
    const li = document.createElement('li');
    li.className = 'transaction';
    li.innerHTML = `<div class="meta"><div class="dot" style="background:#cbd5e1">—</div><div><div class="title">Nenhuma transação</div><div class="cat muted">Adicione uma nova transação</div></div></div>`;
    listEl.appendChild(li);
    return;
  }

  filtered.forEach(t=>{
    const li = document.createElement('li');
    li.className = 'transaction';
    const color = CATEGORY_COLORS[t.category] || '#94a3b8';
    const amountClass = t.type === 'income' ? 'in' : 'out';
    const sign = t.type === 'income' ? '+' : '-';
    li.innerHTML = `
      <div class="meta">
        <div class="dot" style="background:${color}">${t.name[0] || 'T'}</div>
        <div>
          <div class="title">${t.name}</div>
          <div class="cat muted">${t.category} • ${new Date(t.date).toLocaleDateString()}</div>
        </div>
      </div>
      <div class="value">
        <div class="amount ${amountClass}">${sign} ${formatCurrency(Number(t.amount))}</div>
        <div style="text-align:right;margin-top:6px"><button class="btn outline small" data-id="${t.id}">Excluir</button></div>
      </div>
    `;

    listEl.appendChild(li);
  })

  // Delegation para excluir
  listEl.querySelectorAll('button[data-id]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const id = btn.getAttribute('data-id');
      if(confirm('Excluir esta transação?')){
        transactions = transactions.filter(t=>t.id !== id);
        saveTransactions(transactions);
        updateAll();
      }
    })
  })
}

// =========================
// Chart
function createChart(){
  const ctx = document.getElementById('pieChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'pie',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], hoverOffset: 8 }] },
    options: {
      responsive:true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (ctx)=> `${ctx.label}: ${formatCurrency(ctx.raw)}` } }
      },
      onClick: (evt, elems) => {
        if(elems.length){
          const idx = elems[0].index;
          const label = chart.data.labels[idx];
          renderList(label);
        } else {
          renderList(null, $('#search').value.trim());
        }
      }
    }
  })
}

function updateChart(){
  const totals = categoryTotals(transactions);
  const labels = Object.keys(totals);
  const data = labels.map(l=>totals[l]);
  const colors = labels.map(l=>CATEGORY_COLORS[l] || '#94a3b8');

  if(!chart){ createChart(); }

  // Se sem dados de despesa, mostrar uma fatia neutra
  if(data.length === 0){
    chart.data.labels = ['Sem despesas'];
    chart.data.datasets[0].data = [1];
    chart.data.datasets[0].backgroundColor = ['#e6e9ef'];
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = colors;
  }
  chart.update();
}

// =========================
// UI interactions
function openModal(mode='income'){
  $('#modal').classList.remove('hidden');
  $('#modalTitle').textContent = mode === 'income' ? 'Adicionar Receita' : 'Adicionar Despesa';
  $('#t-type').value = mode === 'income' ? 'income' : 'expense';
  $('#t-name').focus();
}

function closeModal(){
  $('#modal').classList.add('hidden');
  $('#transactionForm').reset();
}

function updateAll(){
  renderSummary();
  renderList(null, $('#search').value.trim());
  updateChart();
}

// =========================
// Eventos
document.addEventListener('DOMContentLoaded', ()=>{
  // Inicial render
  renderSummary();
  renderList();
  createChart();
  updateChart();

  // Botões abrir modal
  $('#addIncomeBtn').addEventListener('click', ()=> openModal('income'));
  $('#addExpenseBtn').addEventListener('click', ()=> openModal('expense'));

  // Fecha modal
  $('#closeModal').addEventListener('click', closeModal);
  $('#cancel').addEventListener('click', closeModal);

  // Form submit
  $('#transactionForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = $('#t-name').value.trim();
    const category = $('#t-category').value;
    const amount = Number($('#t-amount').value) || 0;
    const type = $('#t-type').value;
    if(!name || amount <= 0){
      alert('Preencha nome e valor válidos.');
      return;
    }
    const tx = { id: cryptoRandomId(), name, category, amount: Math.abs(amount), type, date: Date.now() };
    transactions.push(tx);
    saveTransactions(transactions);
    closeModal();
    updateAll();
  });

  // Pesquisa
  $('#search').addEventListener('input', (e)=>{
    renderList(null, e.target.value.trim());
  });

  // Theme toggle (dark / light)
  $('#themeToggle').addEventListener('click', ()=>{
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    $('#themeToggle').textContent = isDark ? '☀️' : '🌙';
  });
});

// Expose for debugging (optional)
window._mf = { get state(){ return {transactions} }, add(tx){ transactions.push(tx); saveTransactions(transactions); updateAll(); } };
