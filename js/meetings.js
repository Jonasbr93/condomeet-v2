function renderMiniCal(){
  const c = $i('mini-cal');
  const today = new Date(); today.setHours(0,0,0,0);
  const y = calViewYear, m = calViewMonth;
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const firstDay = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
  let h = `<div class="mini-cal-nav">
    <button onclick="calNav(-1)">&#8249;</button>
    <span class="month-label">${months[m]} ${y}</span>
    <button onclick="calNav(1)">&#8250;</button>
  </div><div class="mini-cal-grid">
    <div class="mini-cal-dow">Dom</div><div class="mini-cal-dow">Seg</div><div class="mini-cal-dow">Ter</div>
    <div class="mini-cal-dow">Qua</div><div class="mini-cal-dow">Qui</div><div class="mini-cal-dow">Sex</div><div class="mini-cal-dow">Sáb</div>`;
  for (let i = 0; i < firstDay; i++) h += '<div class="mini-cal-day empty"></div>';
  for (let d = 1; d <= days; d++){
    const date = new Date(y, m, d); date.setHours(0,0,0,0);
    const ds = `${y}-${ph(m+1)}-${ph(d)}`;
    const past = date < today, isToday = date.getTime() === today.getTime();
    let cls = 'mini-cal-day';
    if (past) cls += ' past'; if (isToday) cls += ' today';
    if (calData[ds]) cls += ' has-date'; if (ds === selectedDate) cls += ' selected';
    h += `<div class="${cls}" ${past ? '' : `onclick="selectDate('${ds}')"`}>${d}</div>`;
  }
  h += '</div>'; c.innerHTML = h;
}

function calNav(dir){
  calViewMonth += dir;
  if (calViewMonth > 11){ calViewMonth = 0; calViewYear++; }
  if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
  renderMiniCal();
}

async function selectDate(ds){
  selectedDate = ds; renderMiniCal();
  if (!calData[ds]){
    if (!canAddDates()){ renderAvailPanel(ds); return; }
    const {data, error} = await sb.from('calendar_dates').insert({condominium_id: CFG_CONDO_ID, date: ds, created_by: currentProfile.id}).select().single();
    if (error){ showToast('Erro: ' + error.message, 'error'); return; }
    calData[ds] = {dateId: data.id, slots: {}}; TIME_SLOTS.forEach(t => calData[ds].slots[t] = []);
    renderMiniCal();
  }
  renderAvailPanel(ds);
}

function renderAvailPanel(ds){
  const panel = $i('avail-panel'); panel.style.display = '';
  $i('avail-title').textContent = `📋 ${fmtDate(ds)}`;
  const entry = calData[ds];
  if (!entry){
    $i('avail-subtitle').textContent = 'Esta data ainda não foi aberta pelo administrador.';
    $i('slots-grid').innerHTML = '<p style="color:var(--muted);font-size:.83rem">O administrador ainda não abriu esta data.</p>';
    panel.scrollIntoView({behavior: 'smooth', block: 'nearest'}); return;
  }
  const myId = currentProfile.id;
  const people = new Set(Object.values(entry.slots).flatMap(arr => arr.map(a => a.profile_id)).filter(Boolean));
  $i('avail-subtitle').textContent = people.size > 0
    ? `${people.size} pessoa${people.size > 1 ? 's' : ''} responderam. Clique num horário para ver detalhes.`
    : 'Seja o primeiro! Clique num horário para marcar disponibilidade.';
  let h = '';
  TIME_SLOTS.forEach(t => {
    const pp = entry.slots[t] || [], cnt = pp.length;
    const isMine = pp.some(a => a.profile_id === myId);
    const isActive = ds === selectedDate && t === selectedSlot;
    let cls = 'slot-btn';
    if (isMine) cls += ' mine'; else if (cnt > 0) cls += ' others';
    if (isActive) cls += ' active-slot';
    const avs = pp.slice(0, 3).map(a => `<span class="slot-av${a.profile_id === myId ? ' me' : ''}">${initials(a.profiles?.full_name)}</span>`).join('');
    const extra = cnt > 3 ? `<span class="slot-av" style="background:var(--muted)">+${cnt - 3}</span>` : '';
    h += `<button class="${cls}" onclick="openSidePanel('${ds}','${t}')">
      <span class="slot-time">${t}</span>
      ${cnt > 0 ? `<div class="slot-avatars">${avs}${extra}</div>` : '<div style="height:18px"></div>'}
      <span class="slot-clbl">${cnt > 0 ? cnt + (cnt > 1 ? ' pessoas' : ' pessoa') : '—'}</span>
    </button>`;
  });
  $i('slots-grid').innerHTML = h;
  panel.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}

function openSidePanel(ds, slot){
  selectedSlot = slot;
  $i('sp-title').textContent = `🕐 ${slot}`;
  $i('sp-sub').textContent = fmtDate(ds);
  renderSidePanel(ds, slot);
  $i('side-panel').classList.add('open');
  $i('app-main').classList.add('panel-open');
  if (selectedDate) renderAvailPanel(selectedDate);
}

function closeSidePanel(){
  selectedSlot = null;
  $i('side-panel').classList.remove('open');
  $i('app-main').classList.remove('panel-open');
  if (selectedDate) renderAvailPanel(selectedDate);
}

function renderSidePanel(ds, slot){
  const entry = calData[ds]; if (!entry) return;
  const pp = entry.slots[slot] || [], myId = currentProfile.id;
  const myAvail = pp.find(a => a.profile_id === myId);

  $i('sp-body').innerHTML = pp.length === 0
    ? '<div class="empty-state"><div class="ei">🙋</div>Ninguém marcou ainda.</div>'
    : pp.map(a => {
        const prof = a.profiles || {};
        const isMe = a.profile_id === myId;
        const name = prof.full_name || currentProfile.full_name || '?';
        const frac = prof.fraction || currentProfile.fraction || '—';
        const role = prof.role || currentProfile.role || 'resident';
        return `<div class="person-card">
          <div class="person-top">
            <div class="p-avatar${isMe ? ' me' : ''}">${initials(name)}</div>
            <div class="p-info">
              <div class="p-name">${esc(name)}${isMe ? '<span class="you-badge">Eu</span>' : ''}${badge(role, ROLES_PT[role] || role)}</div>
              <div class="p-frac">Fração ${esc(frac)}</div>
            </div>
          </div>
          ${a.note ? `<div class="p-note">💬 ${esc(a.note)}</div>` : ''}
        </div>`;
      }).join('');

  const footer = $i('sp-footer');
  if (myAvail){
    footer.innerHTML = `<div class="my-action">
      <div class="note-label">A minha nota:</div>
      <textarea id="sp-note" placeholder="Ex: Só posso 15 minutos...">${esc(myAvail.note || '')}</textarea>
      <div class="my-action-btns">
        <button class="btn btn-primary btn-sm" onclick="saveNote('${ds}','${slot}')">💾 Guardar nota</button>
        <button class="btn btn-danger btn-sm" onclick="removeAvail('${ds}','${slot}')">✕ Remover</button>
      </div>
    </div>`;
  } else {
    footer.innerHTML = `<div class="my-action">
      <div class="note-label">Nota (opcional):</div>
      <textarea id="sp-note" placeholder="Ex: Só posso 15 minutos..."></textarea>
      <div class="my-action-btns">
        <button class="btn btn-primary btn-sm" onclick="addAvail('${ds}','${slot}')">✓ Marcar disponibilidade</button>
      </div>
    </div>`;
  }
}

async function addAvail(ds, slot){
  const entry = calData[ds]; if (!entry) return;
  const note = ($i('sp-note')?.value || '').trim();
  const {data, error} = await sb.from('availabilities')
    .insert({calendar_date_id: entry.dateId, profile_id: currentProfile.id, time_slot: slot, note: note || null})
    .select('id,calendar_date_id,profile_id,time_slot,note,profiles(id,full_name,fraction,role)').single();
  if (error){ showToast('Erro: ' + error.message, 'error'); return; }
  if (!data.profiles) data.profiles = {id: currentProfile.id, full_name: currentProfile.full_name, fraction: currentProfile.fraction, role: currentProfile.role};
  entry.slots[slot] = [...(entry.slots[slot] || []), data];
  renderSidePanel(ds, slot); renderAvailPanel(ds); renderTopSlots(); renderMiniCal();
  showToast('Disponibilidade marcada!', 'success');
}

async function removeAvail(ds, slot){
  const entry = calData[ds]; if (!entry) return;
  const mine = entry.slots[slot]?.find(a => a.profile_id === currentProfile.id);
  if (!mine) return;
  const {error} = await sb.from('availabilities').delete().eq('id', mine.id);
  if (error){ showToast('Erro: ' + error.message, 'error'); return; }
  entry.slots[slot] = entry.slots[slot].filter(a => a.id !== mine.id);
  renderSidePanel(ds, slot); renderAvailPanel(ds); renderTopSlots(); renderMiniCal();
  showToast('Removido.', 'info');
}

async function saveNote(ds, slot){
  const entry = calData[ds]; if (!entry) return;
  const idx = entry.slots[slot]?.findIndex(a => a.profile_id === currentProfile.id);
  if (idx < 0) return;
  const note = ($i('sp-note')?.value || '').trim();
  const mine = entry.slots[slot][idx];
  const {error} = await sb.from('availabilities').update({note: note || null}).eq('id', mine.id);
  if (error){ showToast('Erro: ' + error.message, 'error'); return; }
  entry.slots[slot][idx] = {...mine, note: note || null};
  renderSidePanel(ds, slot);
  showToast('Nota guardada!', 'success');
}

function renderTopSlots(){
  const grid = $i('top-grid');
  const entries = [];
  Object.entries(calData).forEach(([ds, entry]) => {
    TIME_SLOTS.forEach(t => { const pp = entry.slots[t] || []; if (pp.length > 0) entries.push({ds, t, count: pp.length, pp}); });
  });
  entries.sort((a, b) => b.count - a.count);
  const top = entries.slice(0, 3);
  if (!top.length){ grid.innerHTML = '<div style="color:var(--muted);font-size:.85rem">Ainda sem disponibilidades.</div>'; return; }
  const cls = ['p1','p2','p3'], medals = ['🥇 1.º','🥈 2.º','🥉 3.º'];
  grid.innerHTML = top.map((e, i) => {
    const names = e.pp.slice(0, 3).map(a => { const n = a.profiles?.full_name || '?'; return esc(n); });
    const extra = e.count > 3 ? ` +${e.count - 3}` : '';
    return `<div class="top-card ${cls[i]}" onclick="selectDate('${e.ds}').then(()=>openSidePanel('${e.ds}','${e.t}'))">
      <div class="tc-rank">${medals[i]}</div>
      <div class="tc-dt">${fmtDate(e.ds)} · ${e.t}</div>
      <div class="tc-count">${e.count} pessoa${e.count > 1 ? 's' : ''} disponível${e.count > 1 ? 'is' : ''}</div>
      <div class="tc-names">${names.join(', ')}${extra}</div>
    </div>`;
  }).join('');
}
