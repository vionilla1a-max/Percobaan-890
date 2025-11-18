// Key / DB
const APP_KEY = 'fokusMasaDepanDB_v2';

// Default DB
function getISODate(d = new Date()){
  return d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2);
}
function getDefaultDB() {
  return {
    saldo: 0,
    dream: { title: 'Atur Impian Anda!', targetAmount: 0, targetDate: getISODate() },
    settings: {
      limitBulanan: 0,
      motivasi: { kuning: 'Hati-hati, pengeluaranmu banyak!', merah: 'STOP! Kamu sudah boros!' },
      kategori: ['🍔 Makanan','🚌 Transportasi','💡 Tagihan','🏠 Sewa/Cicilan','🎬 Hiburan','👕 Belanja','Lainnya'],
      notifikasi: { aktif: false, waktu: '09:00' }
    },
    transactions: []
  };
}

let db = getDefaultDB();
let currentTxType = 'pengeluaran';
let myAnalysisChart = null;

document.addEventListener('DOMContentLoaded', () => {
  loadDB();
  populateCategorySelects();
  document.getElementById('form-tx-tanggal').value = getISODate();
  navigateTo('page-dashboard');
  renderDashboard();
});

// DB
function loadDB() {
  const raw = localStorage.getItem(APP_KEY);
  if (raw) {
    try { db = JSON.parse(raw); } catch (e) { db = getDefaultDB(); }
  } else {
    db = getDefaultDB();
    saveDB();
  }
}
function saveDB() {
  try { localStorage.setItem(APP_KEY, JSON.stringify(db)); }
  catch(e){ showToast('Gagal menyimpan data','error'); }
}

// NAV & MODAL
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const dest = document.getElementById(pageId);
  if (dest) { dest.classList.remove('hidden'); dest.classList.add('active'); window.scrollTo(0,0); }

  // render page-specific
  if (pageId === 'page-dashboard') renderDashboard();
  if (pageId === 'page-history') renderHistoryPage();
  if (pageId === 'page-analysis') renderAnalysisPage();
  if (pageId === 'page-settings-limit') renderSettingsLimitPage();
  if (pageId === 'page-settings-kategori') renderSettingsKategoriPage();
  if (pageId === 'page-settings-motivasi') renderSettingsMotivasiPage();
  if (pageId === 'page-settings-notifikasi') renderSettingsNotifikasiPage();
}

function showModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.add('modal-overlay');
  // modal-specific prefill
  if (id === 'modal-edit-dream') {
    document.getElementById('form-dream-title').value = db.dream.title || '';
    document.getElementById('form-dream-target').value = db.dream.targetAmount || '';
    document.getElementById('form-dream-date').value = db.dream.targetDate || getISODate();
  }
  if (id === 'modal-add-tx') {
    document.getElementById('form-tx-nominal').value = '';
    document.getElementById('form-tx-alasan').value = '';
    document.getElementById('form-tx-tanggal').value = getISODate();
    switchTxType('pengeluaran');
  }
}

function hideModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('hidden');
  el.classList.remove('modal-overlay');
}

// TRANSAKSI
function switchTxType(type) {
  currentTxType = type;
  const tabP = document.getElementById('tab-pengeluaran');
  const tabM = document.getElementById('tab-pemasukan');
  const kgrp = document.getElementById('form-tx-kategori-group');
  if (type === 'pengeluaran') {
    tabP.classList.add('text-primary'); tabP.classList.remove('text-gray-500');
    tabP.classList.add('border-b-2','border-primary');
    tabM.classList.remove('border-b-2','border-primary'); tabM.classList.add('text-gray-500');
    kgrp.style.display = 'block';
  } else {
    tabM.classList.add('text-primary'); tabM.classList.remove('text-gray-500');
    tabM.classList.add('border-b-2','border-primary');
    tabP.classList.remove('border-b-2','border-primary'); tabP.classList.add('text-gray-500');
    kgrp.style.display = 'none';
  }
}

function saveTransaction() {
  const amount = parseFloat(document.getElementById('form-tx-nominal').value) || 0;
  const category = (currentTxType === 'pengeluaran') ? document.getElementById('form-tx-kategori').value : 'Pemasukan';
  const note = document.getElementById('form-tx-alasan').value;
  const date = document.getElementById('form-tx-tanggal').value || getISODate();

  if (!amount || amount <= 0) return showToast('Nominal harus diisi dan > 0','error');

  const tx = { id: Date.now().toString(), type: currentTxType, amount, category, note, date };
  db.transactions.push(tx);
  db.saldo += (currentTxType === 'pemasukan') ? amount : -amount;
  saveDB();
  hideModal('modal-add-tx');
  showToast('Transaksi berhasil disimpan!','success');
  renderDashboard();
}

// HISTORY & ANALYSIS
function filterTransactions(transactions, filter) {
  const now = new Date();
  const today = getISODate();
  const year = now.getFullYear(), month = now.getMonth(), day = now.getDate();
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(year, month, day - dayOfWeek);
  const startOfMonth = new Date(year, month, 1);
  const startOfYear = new Date(year, 0, 1);
  switch(filter) {
    case 'today': return transactions.filter(t => t.date === today);
    case 'week': return transactions.filter(t => t.date >= getISODate(startOfWeek) && t.date <= today);
    case 'month': return transactions.filter(t => t.date >= getISODate(startOfMonth) && t.date <= today);
    case 'year': return transactions.filter(t => t.date >= getISODate(startOfYear) && t.date <= today);
    default: return transactions;
  }
}

function renderHistoryPage() {
  const filter = document.getElementById('history-filter-time') ? document.getElementById('history-filter-time').value : 'month';
  const filtered = filterTransactions(db.transactions, filter).slice().sort((a,b)=> new Date(b.date) - new Date(a.date));
  const listEl = document.getElementById('history-full-list');
  const totalInEl = document.getElementById('hist-total-in');
  const totalOutEl = document.getElementById('hist-total-out');

  let totalIn = 0, totalOut = 0, html = '';
  if (!filtered.length) {
    listEl.innerHTML = '<p class="text-center text-gray-500 py-8">Tidak ada transaksi untuk periode ini.</p>';
  } else {
    filtered.forEach(tx => {
      if (tx.type === 'pemasukan') totalIn += tx.amount; else totalOut += tx.amount;
      const amountHtml = tx.type === 'pemasukan' ? `<span class="font-bold text-success">+${formatRupiah(tx.amount)}</span>` : `<span class="font-bold text-danger">-${formatRupiah(tx.amount)}</span>`;
      html += `<div class="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center">
                  <div>
                    <p class="font-semibold text-gray-800">${tx.category}</p>
                    <p class="text-sm text-gray-500">${formatDate(tx.date)}</p>
                  </div>
                  <div>${amountHtml}</div>
               </div>`;
    });
    listEl.innerHTML = html;
  }
  totalInEl.textContent = formatRupiah(totalIn);
  totalOutEl.textContent = formatRupiah(totalOut);
}

function renderAnalysisPage() {
  const filter = document.getElementById('analysis-filter-time') ? document.getElementById('analysis-filter-time').value : 'month';
  const pengeluaranAll = db.transactions.filter(t => t.type === 'pengeluaran');
  const filtered = filterTransactions(pengeluaranAll, filter);
  const limit = db.settings.limitBulanan || 0;
  const terpakai = filtered.reduce((s,t)=> s+t.amount, 0);
  const sisa = limit - terpakai;
  document.getElementById('analysis-limit').textContent = formatRupiah(limit);
  document.getElementById('analysis-terpakai').textContent = formatRupiah(terpakai);
  document.getElementById('analysis-sisa').textContent = formatRupiah(sisa);

  const spendingByCategory = filtered.reduce((acc,tx)=> { acc[tx.category] = (acc[tx.category]||0) + tx.amount; return acc; }, {});
  const labels = Object.keys(spendingByCategory), data = Object.values(spendingByCategory);

  const ctx = document.getElementById('analysis-chart').getContext('2d');
  if (myAnalysisChart) myAnalysisChart.destroy();
  if (labels.length) {
    myAnalysisChart = new Chart(ctx, {
      type: 'pie',
      data: { labels, datasets: [{ data, backgroundColor: ['#ef4444','#f59e0b','#22c55e','#3b82f6','#8b5cf6','#ec4899','#f97316','#06b6d4','#14b8a6','#65a30d'] }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' }}}
    });
  } else {
    ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9ca3af';
    ctx.font = '16px Inter';
    ctx.fillText('Tidak ada data pengeluaran', ctx.canvas.width/2, ctx.canvas.height/2);
  }
}

// DASHBOARD
function renderDashboard() {
  document.getElementById('dash-saldo').textContent = formatRupiah(db.saldo);
  const { title, targetAmount, targetDate } = db.dream;
  const progress = (targetAmount>0) ? (db.saldo/targetAmount)*100 : 0;
  const pct = Math.min(Math.max(progress,0),100);
  document.getElementById('dash-dream-title').textContent = title;
  document.getElementById('dash-dream-target-amount').textContent = formatRupiah(targetAmount);
  document.getElementById('dash-dream-target-date').textContent = formatDate(targetDate, { month:'short', year:'numeric' });
  document.getElementById('dash-dream-progress').style.width = `${pct}%`;
  document.getElementById('dash-dream-progress-percent').textContent = `${pct.toFixed(1)}%`;

  // budget
  const limit = db.settings.limitBulanan || 0;
  const pengeluaranBulanIni = filterTransactions(db.transactions.filter(tx=>tx.type==='pengeluaran'),'month').reduce((s,t)=>s+t.amount,0);
  const sisa = limit - pengeluaranBulanIni;
  const sisaPercent = limit>0 ? (sisa/limit)*100 : 0;
  document.getElementById('dash-budget-limit').textContent = formatRupiah(limit);
  document.getElementById('dash-budget-sisa').textContent = formatRupiah(sisa);

  const indicatorEl = document.getElementById('dash-budget-indicator');
  const warningEl = document.getElementById('dash-budget-warning');
  if (limit === 0) {
    indicatorEl.className = 'px-3 py-1 rounded-full text-sm font-semibold text-white bg-gray-400';
    indicatorEl.textContent = '...'; warningEl.textContent = 'Atur limit budget Anda di Pengaturan.';
  } else if (sisaPercent > 40) {
    indicatorEl.className = 'px-3 py-1 rounded-full text-sm font-semibold text-white';
    indicatorEl.style.background = '#22c55e'; indicatorEl.textContent = 'Aman'; warningEl.textContent = '';
  } else if (sisaPercent > 10) {
    indicatorEl.className = 'px-3 py-1 rounded-full text-sm font-semibold text-white';
    indicatorEl.style.background = '#f97316'; indicatorEl.textContent = 'Hati-hati'; warningEl.textContent = db.settings.motivasi.kuning;
  } else {
    indicatorEl.className = 'px-3 py-1 rounded-full text-sm font-semibold text-white';
    indicatorEl.style.background = '#ef4444'; indicatorEl.textContent = 'Bahaya'; warningEl.textContent = db.settings.motivasi.merah;
  }

  // recent tx
  const listEl = document.getElementById('dash-history-list');
  const recent = [...db.transactions].sort((a,b)=> new Date(b.date)-new Date(a.date)).slice(0,5);
  if (!recent.length) listEl.innerHTML = '<p class="text-center text-gray-500 py-4">Belum ada transaksi.</p>';
  else {
    listEl.innerHTML = recent.map(tx => {
      const amt = tx.type==='pemasukan' ? `<span class="font-bold text-success">+${formatRupiah(tx.amount)}</span>` : `<span class="font-bold text-danger">-${formatRupiah(tx.amount)}</span>`;
      return `<div class="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
                <div><p class="font-semibold text-gray-800">${tx.category}</p><p class="text-sm text-gray-500">${formatDate(tx.date)}</p></div>
                <div>${amt}</div>
              </div>`;
    }).join('');
  }
}

// UTIL
function formatRupiah(num) {
  if (isNaN(num)) num = 0;
  return new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0 }).format(num);
}
function formatDate(dStr, options={ day:'numeric', month:'short', year:'numeric'}) {
  try {
    const d = new Date(dStr + 'T00:00:00'); return new Intl.DateTimeFormat('id-ID', options).format(d);
  } catch(e){ return dStr; }
}

// SETTINGS
function renderSettingsLimitPage() {
  document.getElementById('setting-limit-bulanan').value = db.settings.limitBulanan || 0;
}
function saveSettingsLimit() {
  const val = parseFloat(document.getElementById('setting-limit-bulanan').value) || 0;
  db.settings.limitBulanan = val; saveDB(); showToast('Limit berhasil disimpan!','success'); navigateTo('page-settings');
}

function renderSettingsKategoriPage() {
  const listEl = document.getElementById('settings-kategori-list'); listEl.innerHTML = '';
  db.settings.kategori.forEach((k,i)=>{
    const div = document.createElement('div'); div.className = 'flex justify-between items-center p-3 bg-gray-100 rounded-lg';
    div.innerHTML = `<span class="text-gray-800">${k}</span><button class="text-red-500" onclick="deleteCategory(${i})">Hapus</button>`;
    listEl.appendChild(div);
  });
}
function addCategory() {
  const v = document.getElementById('setting-kategori-baru').value.trim();
  if (!v) return;
  db.settings.kategori.push(v); saveDB(); document.getElementById('setting-kategori-baru').value=''; renderSettingsKategoriPage(); populateCategorySelects(); showToast('Kategori ditambahkan!','success');
}
function deleteCategory(i) {
  const name = db.settings.kategori[i];
  db.settings.kategori.splice(i,1); saveDB(); renderSettingsKategoriPage(); populateCategorySelects(); showToast(`Kategori "${name}" dihapus.`);
}

function renderSettingsMotivasiPage() {
  document.getElementById('setting-motivasi-kuning').value = db.settings.motivasi.kuning;
  document.getElementById('setting-motivasi-merah').value = db.settings.motivasi.merah;
}
function saveSettingsMotivasi() {
  db.settings.motivasi.kuning = document.getElementById('setting-motivasi-kuning').value;
  db.settings.motivasi.merah = document.getElementById('setting-motivasi-merah').value;
  saveDB(); showToast('Motivasi berhasil disimpan!','success'); navigateTo('page-settings');
}

function renderSettingsNotifikasiPage() {
  document.getElementById('setting-notif-aktif').checked = db.settings.notifikasi.aktif;
  document.getElementById('setting-notif-waktu').value = db.settings.notifikasi.waktu;
}
function saveSettingsNotifikasi() {
  db.settings.notifikasi.aktif = document.getElementById('setting-notif-aktif').checked;
  db.settings.notifikasi.waktu = document.getElementById('setting-notif-waktu').value;
  saveDB(); showToast('Pengaturan notifikasi disimpan!','success'); navigateTo('page-settings');
}

// Reset
function resetApp() {
  hideModal('modal-confirm-reset');
  localStorage.removeItem(APP_KEY);
  showToast('Data berhasil direset. Memuat ulang...','success');
  setTimeout(()=> location.reload(), 900);
}

// Populate categories
function populateCategorySelects() {
  const sel = document.getElementById('form-tx-kategori');
  if (!sel) return;
  sel.innerHTML = '';
  db.settings.kategori.forEach(k => {
    const opt = document.createElement('option'); opt.value = k; opt.textContent = k; sel.appendChild(opt);
  });
}

// Toast
let toastTimer = null;
function showToast(message, type='default') {
  const t = document.getElementById('toast');
  t.textContent = message;
  if (type === 'success') t.style.background = '#22c55e';
  else if (type === 'error') t.style.background = '#ef4444';
  else t.style.background = '#333';
  t.classList.remove('hidden'); t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> { t.classList.remove('show'); t.classList.add('hidden'); }, 3000);
}
