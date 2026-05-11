function quotaNavYear(dir){
  quotaYear += dir;
  loadQuotas().then(() => renderQuotas());
}

function getPayment(fracId, month){
  return quotaPayments.find(p => p.fraction_id === fracId && p.month === month) || null;
}

function renderQuotas(){
  $i('quota-year-label').textContent = quotaYear;

  const myFrac = currentProfile.fraction?.toUpperCase();
  const fracs = quotaFractions;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const dueMths = quotaYear < currentYear ? 12
    : quotaYear === currentYear ? currentMonth - 1
    : 0;

  let debtAmt = 0, debtFracs = 0;
  fracs.forEach(f => {
    let fracDebt = 0;
    for (let m = 1; m <= dueMths; m++){
      const pmt = getPayment(f.id, m);
      if (!pmt || pmt.status !== 'paid') fracDebt += Number(f.monthly_amount);
    }
    if (fracDebt > 0) debtFracs++;
    debtAmt += fracDebt;
  });

  let myDebt = 0;
  if (!isAdmin() && myFrac){
    const myF = fracs.find(f => f.fraction.toUpperCase() === myFrac);
    if (myF){
      for (let m = 1; m <= dueMths; m++){
        const pmt = getPayment(myF.id, m);
        if (!pmt || pmt.status !== 'paid') myDebt += Number(myF.monthly_amount);
      }
    }
  }

  const allPmts = quotaPayments;
  const paid = allPmts.filter(p => p.status === 'paid').length;
  const overdue = allPmts.filter(p => p.status === 'overdue').length;
  const paidAmt = fracs.reduce((s, f) => {
    const ct = quotaPayments.filter(p => p.fraction_id === f.id && p.status === 'paid').length;
    return s + ct * Number(f.monthly_amount);
  }, 0);
  const totalAmt = fracs.reduce((s, f) => s + 12 * Number(f.monthly_amount), 0);

  const displayDebt = isAdmin() ? debtAmt : myDebt;
  const debtCard = displayDebt > 0
    ? `<div class="stat-card" style="border-left:3px solid var(--danger)">
        <div class="sv" style="color:var(--danger)">€${displayDebt.toFixed(2)}</div>
        <div class="sl">${isAdmin() ? `Em dívida (${debtFracs} fração${debtFracs > 1 ? 'ões' : ''})` : 'A minha dívida'}</div>
       </div>`
    : `<div class="stat-card" style="border-left:3px solid var(--success)">
        <div class="sv" style="color:var(--success)">€0</div>
        <div class="sl">Sem dívidas</div>
       </div>`;

  const globalDebtCard = !isAdmin() ? `
    <div class="stat-card" style="border-left:3px solid #f59e0b">
      <div class="sv" style="color:#b45309">€${debtAmt.toFixed(2)}</div>
      <div class="sl">Total em dívida (condomínio)</div>
    </div>` : '';

  const totalUnpaidCount = fracs.reduce((s, f) => {
    let c = 0;
    for (let m = 1; m <= dueMths; m++){ const p = getPayment(f.id, m); if (!p || p.status !== 'paid') c++; }
    return s + c;
  }, 0);
  const unpaidCard = !isAdmin() ? `
    <div class="stat-card">
      <div class="sv" style="color:var(--muted)">${totalUnpaidCount}</div>
      <div class="sl">Quota${totalUnpaidCount !== 1 ? 's' : ''} por pagar (total)</div>
    </div>` : '';

  $i('quota-stats').innerHTML = `
    ${debtCard}
    ${globalDebtCard}
    ${unpaidCard}
    <div class="stat-card"><div class="sv" style="color:var(--success)">${paid}</div><div class="sl">Pagas</div></div>
    <div class="stat-card"><div class="sv" style="color:var(--danger)">${overdue}</div><div class="sl">Em atraso</div></div>
    <div class="stat-card"><div class="sv">€${paidAmt.toFixed(2)}</div><div class="sl">Recebido</div></div>
    <div class="stat-card"><div class="sv" style="color:var(--muted)">€${totalAmt.toFixed(2)}</div><div class="sl">Total anual</div></div>`;

  if (!fracs.length){
    $i('quota-table').closest('div').innerHTML = `<div class="empty-state"><div class="ei">💶</div>${isAdmin() ? 'Nenhuma fração configurada. Clique em <strong>+ Fração</strong> para começar.' : 'Sem frações configuradas. Contacte o administrador.'}</div>`;
    return;
  }

  let head = `<th class="col-frac">Fração</th><th class="col-desc">Designação</th><th class="col-amt">Quota</th>`;
  MONTHS_SHORT.forEach(m => head += `<th style="min-width:36px">${m}</th>`);
  head += `<th style="min-width:70px">Recebido</th>`;
  if (isAdmin()) head += `<th style="min-width:70px;color:#fca5a5">Dívida</th>`;
  $i('quota-thead').innerHTML = head;

  $i('quota-tbody').innerHTML = fracs.map(f => {
    const paidCount = quotaPayments.filter(p => p.fraction_id === f.id && p.status === 'paid').length;
    const fracPaid = paidCount * Number(f.monthly_amount);
    let fracDebt = 0;
    for (let m = 1; m <= dueMths; m++){
      const pmt = getPayment(f.id, m);
      if (!pmt || pmt.status !== 'paid') fracDebt += Number(f.monthly_amount);
    }
    const isMyFrac = !isAdmin() && f.fraction.trim().toUpperCase() === (currentProfile.fraction || '').trim().toUpperCase();
    let cells = '';
    for (let m = 1; m <= 12; m++){
      const pmt = getPayment(f.id, m);
      const st = pmt?.status || 'empty';
      const icon = st === 'paid' ? '✓' : st === 'overdue' ? '⚠' : st === 'payment_requested' ? '🕐' : st === 'pending' ? '·' : (isMyFrac ? '+' : '');
      const title = pmt?.note ? `title="${esc(pmt.note)}"` : '';
      let clickFn = '';
      if (isAdmin()) clickFn = `onclick="openPaymentModal('${f.id}','${m}','${f.fraction}')"`;
      else if (isMyFrac && st !== 'paid') clickFn = `onclick="openResidentPaymentModal('${f.id}','${m}','${f.fraction}')"`;
      const interactive = isAdmin() || (isMyFrac && st !== 'paid');
      cells += `<td><span class="qcell ${st}${interactive ? '' : ' resident'}" ${title} ${clickFn}>${icon}</span></td>`;
    }
    const editBtn = isAdmin() ? `<button class="btn btn-xs btn-secondary" style="margin-left:6px;padding:1px 5px" onclick="openFractionModal('${f.id}')">✏️</button>` : '';
    const debtCell = isAdmin() ? `<td class="td-total" style="color:${fracDebt > 0 ? 'var(--danger)' : 'var(--success)'}">${fracDebt > 0 ? '€' + fracDebt.toFixed(2) : '✓'}</td>` : '';
    return `<tr>
      <td class="td-frac">${esc(f.fraction)}${editBtn}</td>
      <td class="td-desc">${esc(f.description || '')}</td>
      <td class="td-amt">€${Number(f.monthly_amount).toFixed(2)}</td>
      ${cells}
      <td class="td-total">€${fracPaid.toFixed(2)}</td>
      ${debtCell}
    </tr>`;
  }).join('');

  let foot = `<td colspan="2" style="text-align:left;font-weight:700">TOTAL</td><td class="td-amt">€${fracs.reduce((s, f) => s + Number(f.monthly_amount), 0).toFixed(2)}</td>`;
  for (let m = 1; m <= 12; m++){
    const ct = fracs.filter(f => getPayment(f.id, m)?.status === 'paid').length;
    const ov = fracs.filter(f => getPayment(f.id, m)?.status === 'overdue').length;
    foot += `<td style="font-size:.72rem;line-height:1.2">
      <span class="tfoot-paid">${ct}✓</span>${ov > 0 ? `<br><span class="tfoot-overdue">${ov}⚠</span>` : ''}
    </td>`;
  }
  foot += `<td class="td-total">€${paidAmt.toFixed(2)}</td>`;
  if (isAdmin()) foot += `<td class="td-total" style="color:${debtAmt > 0 ? 'var(--danger)' : 'var(--success)'}">€${debtAmt.toFixed(2)}</td>`;
  $i('quota-tfoot').innerHTML = foot;
}

function openPaymentModal(fracId, month, fracName){
  _pmModalFracId = fracId; _pmModalMonth = Number(month);
  const pmt = getPayment(fracId, Number(month));
  $i('payment-modal-title').textContent = `💶 ${fracName} — ${MONTHS_SHORT[month-1]} ${quotaYear}`;
  $i('pm-status').value = pmt?.status || 'pending';
  $i('pm-note').value = pmt?.note || '';
  clearAlert('payment-err');
  const isRequested = pmt?.status === 'payment_requested';
  $i('pm-confirm-btns').style.display = isRequested ? 'flex' : 'none';
  $i('pm-admin-view').style.display = '';
  $i('pm-resident-view').style.display = 'none';
  openModal('payment-modal');
}

function openResidentPaymentModal(fracId, month, fracName){
  _pmModalFracId = fracId; _pmModalMonth = Number(month);
  const pmt = getPayment(fracId, Number(month));
  $i('payment-modal-title').textContent = `💶 ${fracName} — ${MONTHS_SHORT[month-1]} ${quotaYear}`;
  clearAlert('payment-err');
  $i('pm-admin-view').style.display = 'none';
  $i('pm-resident-view').style.display = '';
  const st = pmt?.status || 'empty';
  const stLabels = {pending:'Pendente', overdue:'Em atraso', payment_requested:'🕐 Pedido enviado', empty:'Por pagar', paid:'Paga'};
  $i('pm-resident-status').innerHTML = `Estado atual: <strong>${stLabels[st] || st}</strong>`;
  if (st === 'payment_requested'){
    $i('pm-request-btn-wrap').style.display = 'none';
    $i('pm-requested-msg').style.display = '';
  } else {
    $i('pm-request-btn-wrap').style.display = '';
    $i('pm-requested-msg').style.display = 'none';
  }
  openModal('payment-modal');
}

async function requestPayment(){
  clearAlert('payment-err');
  const existing = getPayment(_pmModalFracId, _pmModalMonth);
  let error;
  if (existing){
    ({error} = await sb.from('quota_payments').update({status:'payment_requested', requested_at: new Date().toISOString()}).eq('id', existing.id));
  } else {
    ({error} = await sb.from('quota_payments').insert({fraction_id: _pmModalFracId, year: quotaYear, month: _pmModalMonth, status:'payment_requested', requested_at: new Date().toISOString()}));
  }
  if (error){ showAlert('payment-err','Erro: ' + error.message); return; }
  closeModal('payment-modal');
  await loadQuotas(); renderQuotas();
  showToast('Pedido enviado ao administrador!', 'success');
}

async function confirmPaymentRequest(){
  clearAlert('payment-err');
  const existing = getPayment(_pmModalFracId, _pmModalMonth);
  if (!existing) return;
  const {error} = await sb.from('quota_payments').update({status:'paid', paid_at: new Date().toISOString()}).eq('id', existing.id);
  if (error){ showAlert('payment-err','Erro: ' + error.message); return; }
  closeModal('payment-modal');
  await loadQuotas(); renderQuotas();
  showToast('Pagamento confirmado!', 'success');
}

async function rejectPaymentRequest(){
  clearAlert('payment-err');
  const existing = getPayment(_pmModalFracId, _pmModalMonth);
  if (!existing) return;
  const {error} = await sb.from('quota_payments').update({status:'pending', requested_at: null}).eq('id', existing.id);
  if (error){ showAlert('payment-err','Erro: ' + error.message); return; }
  closeModal('payment-modal');
  await loadQuotas(); renderQuotas();
  showToast('Pedido rejeitado.', 'info');
}

async function savePaymentCell(){
  if (!isAdmin()) return;
  const status = $i('pm-status').value;
  const note = ($i('pm-note').value || '').trim() || null;
  clearAlert('payment-err');
  const existing = getPayment(_pmModalFracId, _pmModalMonth);
  const paid_at = status === 'paid' ? (existing?.paid_at || new Date().toISOString()) : null;
  let error;
  if (existing){
    ({error} = await sb.from('quota_payments').update({status, note, paid_at}).eq('id', existing.id));
  } else {
    ({error} = await sb.from('quota_payments').insert({fraction_id: _pmModalFracId, year: quotaYear, month: _pmModalMonth, status, note, paid_at}));
  }
  if (error){ showAlert('payment-err','Erro: ' + error.message); return; }
  closeModal('payment-modal');
  await loadQuotas(); renderQuotas();
  showToast('Guardado!', 'success');
}

function openFractionModal(id = null){
  clearAlert('fraction-err');
  editingFractionId = id;
  if (id){
    const f = quotaFractions.find(x => x.id === id); if (!f) return;
    $i('fraction-modal-title').textContent = '✏️ Editar Fração';
    $i('fr-fraction').value = f.fraction;
    $i('fr-amount').value = f.monthly_amount;
    $i('fr-desc').value = f.description || '';
    $i('fr-order').value = f.sort_order || 0;
    $i('fr-delete-btn').style.display = '';
  } else {
    $i('fraction-modal-title').textContent = '➕ Nova Fração';
    $i('fr-fraction').value = ''; $i('fr-amount').value = ''; $i('fr-desc').value = ''; $i('fr-order').value = '0';
    $i('fr-delete-btn').style.display = 'none';
  }
  openModal('fraction-modal');
}

async function saveFraction(){
  if (!isAdmin()) return;
  const fraction = $i('fr-fraction').value.trim().toUpperCase();
  const monthly_amount = parseFloat($i('fr-amount').value);
  const description = $i('fr-desc').value.trim() || null;
  const sort_order = parseInt($i('fr-order').value) || 0;
  clearAlert('fraction-err');
  if (!fraction){ showAlert('fraction-err','Insira a fração.'); return; }
  if (isNaN(monthly_amount) || monthly_amount < 0){ showAlert('fraction-err','Valor inválido.'); return; }
  let error;
  if (editingFractionId){
    ({error} = await sb.from('quota_fractions').update({fraction, monthly_amount, description, sort_order}).eq('id', editingFractionId));
  } else {
    ({error} = await sb.from('quota_fractions').insert({condominium_id: CFG_CONDO_ID, fraction, monthly_amount, description, sort_order}));
  }
  if (error){ showAlert('fraction-err','Erro: ' + error.message); return; }
  closeModal('fraction-modal');
  await loadQuotas(); renderQuotas();
  showToast(editingFractionId ? 'Fração atualizada!' : 'Fração adicionada!', 'success');
}

async function deleteFraction(){
  if (!editingFractionId || !confirm('Apagar esta fração e todos os seus pagamentos?')) return;
  const {error} = await sb.from('quota_fractions').delete().eq('id', editingFractionId);
  if (error){ showToast('Erro: ' + error.message, 'error'); return; }
  closeModal('fraction-modal');
  await loadQuotas(); renderQuotas();
  showToast('Fração apagada.', 'info');
}
