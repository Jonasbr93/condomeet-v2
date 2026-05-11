function cleaningNavYear(dir){ cleaningYear += dir; loadCleaning().then(() => renderCleaning()); }

function renderCleaning(){
  $i('cleaning-year-label').textContent = cleaningYear;
  const totalN = cleaningRecords.length;
  const totalA = cleaningRecords.reduce((s, r) => s + Number(r.amount || 0), 0);
  $i('cleaning-stats').innerHTML =
    '<div class="stat-card"><div class="sv">' + totalN + '</div><div class="sl">Limpezas ' + cleaningYear + '</div></div>' +
    '<div class="stat-card"><div class="sv">EUR ' + totalA.toFixed(2) + '</div><div class="sl">Total pago</div></div>' +
    '<div class="stat-card"><div class="sv">' + (totalN > 0 ? (totalA / totalN).toFixed(2) : '--') + '</div><div class="sl">EUR / limpeza</div></div>';

  $i('cleaning-tbody').innerHTML = MONTHS_SHORT.map((m, i) => {
    const month = i + 1;
    const recs = cleaningRecords.filter(r => r.date && parseInt(r.date.slice(5, 7)) === month);
    const amt = recs.reduce((s, r) => s + Number(r.amount || 0), 0);
    const dates = recs.map(r => r.date ? r.date.slice(8, 10) + '/' + r.date.slice(5, 7) + '/' + r.date.slice(0, 4) : '').filter(Boolean).join(', ');
    const editBtn = isAdmin() ? '<td><button class="btn btn-xs btn-secondary" onclick="openCleaningMonth(' + month + ')">Gerir</button></td>' : '<td></td>';
    return '<tr>'
      + '<td style="font-weight:600">' + m + '</td>'
      + '<td style="text-align:center">' + (recs.length || '--') + '</td>'
      + '<td style="text-align:right">' + (amt > 0 ? 'EUR ' + amt.toFixed(2) : '--') + '</td>'
      + '<td style="font-size:.78rem;color:var(--muted)">' + dates + '</td>'
      + editBtn
      + '</tr>';
  }).join('');

  $i('cleaning-tfoot').innerHTML =
    '<td style="text-align:left;font-weight:700">TOTAL</td>'
    + '<td style="text-align:center;font-weight:700">' + totalN + '</td>'
    + '<td style="text-align:right;font-weight:700">EUR ' + totalA.toFixed(2) + '</td>'
    + '<td colspan="2"></td>';
}

function openCleaningMonth(month){
  if (!isAdmin()) return;
  _clModalMonth = month;
  $i('cleaning-modal-title').textContent = MONTHS_SHORT[month - 1] + ' ' + cleaningYear;
  $i('cleaning-add-form').style.display = 'none';
  $i('cleaning-add-btn-wrap').style.display = '';
  clearAlert('cleaning-err');
  $i('cl-date').value = cleaningYear + '-' + (month < 10 ? '0' : '') + month + '-01';
  $i('cl-amount').value = '';
  $i('cl-note').value = '';
  renderCleaningEntries(month);
  openModal('cleaning-modal');
}

function renderCleaningEntries(month){
  const recs = cleaningRecords.filter(r => r.date && parseInt(r.date.slice(5, 7)) === month);
  if (!recs.length){
    $i('cleaning-entries-list').innerHTML = '<div style="color:var(--muted);font-size:.85rem;margin-bottom:8px">Sem limpezas registadas.</div>';
    return;
  }
  $i('cleaning-entries-list').innerHTML = recs.map(r => {
    const d = r.date ? r.date.slice(8, 10) + '/' + r.date.slice(5, 7) + '/' + r.date.slice(0, 4) : 'sem data';
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">'
      + '<div style="flex:1">'
        + '<div style="font-weight:600;font-size:.88rem">' + d + '</div>'
        + (r.note ? '<div style="font-size:.78rem;color:var(--muted)">' + esc(r.note) + '</div>' : '')
      + '</div>'
      + '<div style="font-weight:700;color:var(--primary-d)">' + (r.amount ? 'EUR ' + Number(r.amount).toFixed(2) : '') + '</div>'
      + '<button class="btn btn-xs btn-danger" onclick="deleteCleaningEntry(\'' + r.id + '\')">x</button>'
      + '</div>';
  }).join('');
}

async function saveCleaningEntry(){
  if (!isAdmin()) return;
  const date = $i('cl-date').value;
  const amount = parseFloat($i('cl-amount').value) || 0;
  const note = ($i('cl-note').value || '').trim() || null;
  clearAlert('cleaning-err');
  if (!date){ showAlert('cleaning-err','Selecione uma data.'); return; }
  const r = await sb.from('cleaning_dates').insert({condominium_id: CFG_CONDO_ID, date, amount, note, created_by: currentProfile.id});
  if (r.error){ showAlert('cleaning-err','Erro: ' + r.error.message); return; }
  $i('cl-date').value = '';
  $i('cl-amount').value = '';
  $i('cl-note').value = '';
  $i('cleaning-add-form').style.display = 'none';
  $i('cleaning-add-btn-wrap').style.display = '';
  await loadCleaning();
  renderCleaningEntries(_clModalMonth);
  renderCleaning();
  showToast('Limpeza registada!', 'success');
}

async function deleteCleaningEntry(id){
  if (!confirm('Apagar esta limpeza?')) return;
  const r = await sb.from('cleaning_dates').delete().eq('id', id);
  if (r.error){ showToast('Erro: ' + r.error.message, 'error'); return; }
  await loadCleaning();
  renderCleaningEntries(_clModalMonth);
  renderCleaning();
  showToast('Apagado.', 'info');
}
