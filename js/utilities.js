// ── Summary ──────────────────────────────────────────────────────────────────

function summaryNavYear(dir){ summaryYear += dir; renderSummary(); }

async function renderSummary(){
  $i('summary-year-label').textContent = summaryYear;

  const initialBal = Number(currentCondo && currentCondo.initial_balance || 0);
  const totalIn  = cashbookEntries.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalOut = cashbookEntries.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount || 0), 0);
  const balance  = initialBal + totalIn - totalOut;
  const editBalBtn = isAdmin() ? '<button class="btn btn-xs btn-secondary" style="margin-top:8px;font-size:.72rem" onclick="openInitialBalanceModal()">✏️ Editar</button>' : '';

  $i('summary-stats').innerHTML =
    '<div class="stat-card" style="border-left:3px solid var(--muted)"><div class="sv">€' + initialBal.toFixed(2) + '</div><div class="sl">Saldo inicial</div>' + editBalBtn + '</div>' +
    '<div class="stat-card" style="border-left:3px solid var(--success)"><div class="sv" style="color:var(--success)">+€' + totalIn.toFixed(2) + '</div><div class="sl">Total entradas</div></div>' +
    '<div class="stat-card" style="border-left:3px solid var(--danger)"><div class="sv" style="color:var(--danger)">-€' + totalOut.toFixed(2) + '</div><div class="sl">Total saídas</div></div>' +
    '<div class="stat-card" style="border-left:3px solid ' + (balance >= 0 ? 'var(--success)' : 'var(--danger)') + '"><div class="sv" style="color:' + (balance >= 0 ? 'var(--success)' : 'var(--danger)') + '">€' + balance.toFixed(2) + '</div><div class="sl">Saldo atual</div></div>';

  // Movimentos de Caixa
  const CAT_ICON  = {quotas:'💶', cleaning:'🧹', water:'💧', electricity:'💡', maintenance:'🔧', other:'📌'};
  const CAT_LABEL = {quotas:'Quotas', cleaning:'Limpezas', water:'Água', electricity:'Eletricidade', maintenance:'Manutenção', other:'Outro'};
  if (!cashbookEntries.length){
    $i('cashbook-list').innerHTML = '<div class="empty-state"><div class="ei">💳</div>Sem movimentos registados.</div>';
  } else {
    $i('cashbook-list').innerHTML = cashbookEntries.map(e => {
      const d = e.date ? e.date.slice(8, 10) + '/' + e.date.slice(5, 7) + '/' + e.date.slice(0, 4) : '';
      const icon = e.category && CAT_ICON[e.category] ? CAT_ICON[e.category] : (e.type === 'income' ? '💰' : '💸');
      const catLabel = e.category && CAT_LABEL[e.category] ? CAT_LABEL[e.category] : '';
      const isIn = e.type === 'income';
      return '<div class="cb-row">'
        + '<div class="cb-icon" style="background:' + (isIn ? '#d1fae5' : '#fee2e2') + '">' + icon + '</div>'
        + '<div class="cb-info">'
          + '<div class="cb-desc">' + esc(e.description) + '</div>'
          + '<div class="cb-meta">' + d + (catLabel ? ' &middot; <span class="cb-cat">' + catLabel + '</span>' : '') + '</div>'
        + '</div>'
        + '<div class="cb-amount" style="color:' + (isIn ? 'var(--success)' : 'var(--danger)') + '">' + (isIn ? '+' : '-') + '€' + Number(e.amount).toFixed(2) + '</div>'
        + (isAdmin() ? '<button class="btn btn-xs btn-secondary cb-edit-btn" onclick="openCashbookModal(\'' + e.id + '\')">✏️</button>' : '')
        + '</div>';
    }).join('');
  }

  // Resumo Anual
  const yr = summaryYear;
  const clRes = await sb.from('cleaning_dates').select('amount').eq('condominium_id', CFG_CONDO_ID).gte('date', yr + '-01-01').lte('date', yr + '-12-31');
  const utRes = await sb.from('utility_bills').select('water_amount,electricity_amount').eq('condominium_id', CFG_CONDO_ID).eq('year', yr);
  const cbYr  = cashbookEntries.filter(e => e.date && e.date.slice(0, 4) == String(yr));

  const clTotal = (clRes.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const wtTotal = (utRes.data || []).reduce((s, r) => s + Number(r.water_amount || 0), 0);
  const elTotal = (utRes.data || []).reduce((s, r) => s + Number(r.electricity_amount || 0), 0);
  const cbInYr  = cbYr.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount || 0), 0);
  const cbOutYr = cbYr.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount || 0), 0);

  const qPaid = quotaPayments.filter(p => p.status === 'paid' && String(p.year) === String(yr));
  const qIncome = quotaFractions.reduce((s, f) => {
    const ct = qPaid.filter(p => p.fraction_id === f.id).length;
    return s + ct * Number(f.monthly_amount || 0);
  }, 0);
  const issuesCost = allIssues.filter(i => i.cost && i.created_at && i.created_at.slice(0, 4) === String(yr))
    .reduce((s, i) => s + Number(i.cost || 0), 0);

  const incomeRows  = [{icon:'💶', label:'Quotas recebidas', amt: qIncome}, {icon:'📌', label:'Outras entradas', amt: cbInYr}];
  const expenseRows = [
    {icon:'🧹', label:'Limpezas', amt: clTotal},
    {icon:'💧', label:'Água', amt: wtTotal},
    {icon:'💡', label:'Luz', amt: elTotal},
    {icon:'🔧', label:'Ocorrências', amt: issuesCost},
    {icon:'📌', label:'Outras saídas', amt: cbOutYr},
  ];
  const totIn  = incomeRows.reduce((s, r) => s + r.amt, 0);
  const totOut = expenseRows.reduce((s, r) => s + r.amt, 0);
  const result = totIn - totOut;
  const maxAmt = Math.max(totIn, totOut, 1);

  function annualRow(icon, label, amt, type){
    const pct = Math.round((amt / maxAmt) * 100);
    const color = type === 'income' ? 'var(--success)' : 'var(--danger)';
    const bg    = type === 'income' ? '#d1fae5' : '#fee2e2';
    return '<div class="annual-row">'
      + '<div class="annual-icon">' + icon + '</div>'
      + '<div class="annual-label">' + label + '</div>'
      + '<div class="annual-bar-wrap"><div class="annual-bar" style="width:' + pct + '%;background:' + bg + '"></div></div>'
      + '<div class="annual-val" style="color:' + color + '">' + (type === 'income' ? '+' : '-') + '€' + amt.toFixed(2) + '</div>'
      + '</div>';
  }

  $i('summary-annual').innerHTML =
    '<div class="annual-section-title" style="color:var(--success)">📥 Entradas</div>'
    + incomeRows.map(r => annualRow(r.icon, r.label, r.amt, 'income')).join('')
    + '<div class="annual-section-title" style="color:var(--danger);margin-top:16px">📤 Saídas</div>'
    + expenseRows.map(r => annualRow(r.icon, r.label, r.amt, 'expense')).join('')
    + '<div class="annual-totals">'
    + '<div class="annual-total-row" style="background:#f0fdf4"><span>Total entradas ' + yr + '</span><span style="color:var(--success);font-weight:700">+€' + totIn.toFixed(2) + '</span></div>'
    + '<div class="annual-total-row" style="background:#fff5f5"><span>Total saídas ' + yr + '</span><span style="color:var(--danger);font-weight:700">-€' + totOut.toFixed(2) + '</span></div>'
    + '<div class="annual-total-row" style="background:' + (result >= 0 ? '#f0fdf4' : '#fff5f5') + ';font-size:1rem"><span style="font-weight:800">Resultado ' + yr + '</span><span style="color:' + (result >= 0 ? 'var(--success)' : 'var(--danger)') + ';font-weight:800">€' + result.toFixed(2) + '</span></div>'
    + '</div>';
}

function openCashbookModal(id){
  clearAlert('cashbook-err');
  _cbEditingId = id;
  if (id){
    const e = cashbookEntries.find(x => x.id === id); if (!e) return;
    $i('cashbook-modal-title').textContent = 'Editar Movimento';
    $i('cb-type').value = e.type;
    $i('cb-desc').value = e.description;
    $i('cb-amount').value = e.amount;
    $i('cb-date').value = e.date;
    $i('cb-category').value = e.category || '';
    $i('cb-delete-btn').style.display = '';
  } else {
    $i('cashbook-modal-title').textContent = 'Novo Movimento';
    $i('cb-type').value = 'income';
    $i('cb-desc').value = ''; $i('cb-amount').value = '';
    $i('cb-date').value = new Date().toISOString().split('T')[0];
    $i('cb-category').value = '';
    $i('cb-delete-btn').style.display = 'none';
  }
  openModal('cashbook-modal');
}

async function saveCashbook(){
  if (!isAdmin()) return;
  const type = $i('cb-type').value;
  const description = $i('cb-desc').value.trim();
  const amount = parseFloat($i('cb-amount').value);
  const date = $i('cb-date').value;
  const category = $i('cb-category').value || null;
  clearAlert('cashbook-err');
  if (!description){ showAlert('cashbook-err','Insira uma descricao.'); return; }
  if (isNaN(amount) || amount <= 0){ showAlert('cashbook-err','Valor invalido.'); return; }
  if (!date){ showAlert('cashbook-err','Selecione uma data.'); return; }
  let r;
  if (_cbEditingId){
    r = await sb.from('cashbook').update({type, description, amount, date, category}).eq('id', _cbEditingId);
  } else {
    r = await sb.from('cashbook').insert({condominium_id: CFG_CONDO_ID, type, description, amount, date, category, created_by: currentProfile.id});
  }
  if (r.error){ showAlert('cashbook-err','Erro: ' + r.error.message); return; }
  closeModal('cashbook-modal');
  await loadCashbook(); renderSummary();
  showToast(_cbEditingId ? 'Atualizado!' : 'Movimento registado!', 'success');
}

async function deleteCashbook(){
  if (!_cbEditingId || !confirm('Apagar este movimento?')) return;
  const r = await sb.from('cashbook').delete().eq('id', _cbEditingId);
  if (r.error){ showToast('Erro: ' + r.error.message, 'error'); return; }
  closeModal('cashbook-modal');
  await loadCashbook(); renderSummary();
  showToast('Apagado.', 'info');
}

function openInitialBalanceModal(){
  $i('init-bal-value').value = Number(currentCondo && currentCondo.initial_balance || 0).toFixed(2);
  clearAlert('init-bal-err');
  openModal('init-balance-modal');
}

async function saveInitialBalance(){
  if (!isAdmin()) return;
  const val = parseFloat($i('init-bal-value').value);
  if (isNaN(val)){ showAlert('init-bal-err','Valor invalido.'); return; }
  const r = await sb.from('condominiums').update({initial_balance: val}).eq('id', CFG_CONDO_ID);
  if (r.error){ showAlert('init-bal-err','Erro: ' + r.error.message); return; }
  currentCondo.initial_balance = val;
  closeModal('init-balance-modal');
  renderSummary();
  showToast('Saldo inicial atualizado!', 'success');
}

// ── Utilities ────────────────────────────────────────────────────────────────

function utilitiesNavYear(dir){ utilitiesYear += dir; loadUtilities().then(() => renderUtilities()); }

function renderUtilities(){
  $i('utilities-year-label').textContent = utilitiesYear;
  const totalW = utilityBills.reduce((s, r) => s + Number(r.water_amount || 0), 0);
  const totalE = utilityBills.reduce((s, r) => s + Number(r.electricity_amount || 0), 0);
  $i('utilities-stats').innerHTML =
    '<div class="stat-card"><div class="sv">EUR ' + totalW.toFixed(2) + '</div><div class="sl">Agua ' + utilitiesYear + '</div></div>' +
    '<div class="stat-card"><div class="sv">EUR ' + totalE.toFixed(2) + '</div><div class="sl">Luz ' + utilitiesYear + '</div></div>' +
    '<div class="stat-card"><div class="sv">EUR ' + (totalW + totalE).toFixed(2) + '</div><div class="sl">Total</div></div>';

  $i('utilities-tbody').innerHTML = MONTHS_SHORT.map((m, i) => {
    const month = i + 1;
    const rec = utilityBills.find(r => r.month === month);
    const w = rec ? Number(rec.water_amount || 0) : 0;
    const e = rec ? Number(rec.electricity_amount || 0) : 0;
    const btn = isAdmin() ? '<td><button class="btn btn-xs btn-secondary" onclick="openUtilityModal(' + month + ')">' + (rec ? 'Editar' : 'Adicionar') + '</button></td>' : '<td></td>';
    return '<tr>'
      + '<td style="font-weight:600">' + m + '</td>'
      + '<td style="text-align:right">' + (w > 0 ? 'EUR ' + w.toFixed(2) : '--') + '</td>'
      + '<td style="text-align:right">' + (e > 0 ? 'EUR ' + e.toFixed(2) : '--') + '</td>'
      + '<td style="text-align:right;font-weight:600">' + (w + e > 0 ? 'EUR ' + (w + e).toFixed(2) : '--') + '</td>'
      + '<td style="font-size:.78rem;color:var(--muted)">' + esc(rec && rec.note || '') + '</td>'
      + btn
      + '</tr>';
  }).join('');

  $i('utilities-tfoot').innerHTML =
    '<td style="font-weight:700">TOTAL</td>'
    + '<td style="text-align:right;font-weight:700">EUR ' + totalW.toFixed(2) + '</td>'
    + '<td style="text-align:right;font-weight:700">EUR ' + totalE.toFixed(2) + '</td>'
    + '<td style="text-align:right;font-weight:700">EUR ' + (totalW + totalE).toFixed(2) + '</td>'
    + '<td colspan="2"></td>';
}

function openUtilityModal(month){
  if (!isAdmin()) return;
  _utModalMonth = month;
  const rec = utilityBills.find(r => r.month === month);
  _utEditingId = rec ? rec.id : null;
  $i('utility-modal-title').textContent = MONTHS_SHORT[month - 1] + ' ' + utilitiesYear;
  $i('ut-water').value = rec && rec.water_amount != null ? rec.water_amount : '';
  $i('ut-elec').value  = rec && rec.electricity_amount != null ? rec.electricity_amount : '';
  $i('ut-note').value  = rec && rec.note || '';
  $i('ut-delete-btn').style.display = rec ? '' : 'none';
  clearAlert('utility-err');
  openModal('utility-modal');
}

async function saveUtilityBill(){
  if (!isAdmin()) return;
  const water_amount = parseFloat($i('ut-water').value) || 0;
  const electricity_amount = parseFloat($i('ut-elec').value) || 0;
  const note = ($i('ut-note').value || '').trim() || null;
  clearAlert('utility-err');
  let r;
  if (_utEditingId){
    r = await sb.from('utility_bills').update({water_amount, electricity_amount, note}).eq('id', _utEditingId);
  } else {
    r = await sb.from('utility_bills').insert({condominium_id: CFG_CONDO_ID, year: utilitiesYear, month: _utModalMonth, water_amount, electricity_amount, note, created_by: currentProfile.id});
  }
  if (r.error){ showAlert('utility-err','Erro: ' + r.error.message); return; }
  closeModal('utility-modal');
  await loadUtilities(); renderUtilities();
  showToast('Guardado!', 'success');
}

async function deleteUtilityBill(){
  if (!_utEditingId || !confirm('Apagar este registo?')) return;
  const r = await sb.from('utility_bills').delete().eq('id', _utEditingId);
  if (r.error){ showToast('Erro: ' + r.error.message, 'error'); return; }
  closeModal('utility-modal');
  await loadUtilities(); renderUtilities();
  showToast('Apagado.', 'info');
}
