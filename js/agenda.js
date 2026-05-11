function setAgendaFilter(f){
  agendaFilter = f;
  ['open','voting','decided','all'].forEach(x => {
    const b = $i('afilter-' + x);
    b.style.background = x === f ? 'var(--primary)' : '';
    b.style.color = x === f ? '#fff' : '';
    b.className = 'btn btn-sm' + (x === f ? '' : ' btn-secondary');
  });
  renderAgenda();
}

function renderAgenda(){
  const list = agendaFilter === 'all' ? agendaTopics : agendaTopics.filter(t => t.status === agendaFilter);
  if (!list.length){
    $i('agenda-list').innerHTML = '<div class="empty-state"><div class="ei">🗳️</div>Sem topicos.</div>';
    return;
  }
  $i('agenda-list').innerHTML = list.map(topic => {
    const votes = agendaVotes.filter(v => v.topic_id === topic.id);
    const favor = votes.filter(v => v.vote === 'favor').length;
    const contra = votes.filter(v => v.vote === 'contra').length;
    const abst = votes.filter(v => v.vote === 'abstencao').length;
    const myVote = votes.find(v => v.profile_id === currentProfile.id);
    const prof = topic.profiles || {};
    const statusColor = ASTATUS_COLOR[topic.status] || 'var(--muted)';

    const voteBar = topic.status !== 'open'
      ? '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;align-items:center">'
        + '<span style="font-size:.78rem;color:var(--success);font-weight:700">✓ A favor: ' + favor + '</span>'
        + '<span style="font-size:.78rem;color:var(--danger);font-weight:700">✗ Contra: ' + contra + '</span>'
        + '<span style="font-size:.78rem;color:var(--muted);font-weight:700">~ Abstencao: ' + abst + '</span>'
        + '</div>'
      : '';

    const myVoteBadge = myVote
      ? '<span style="font-size:.72rem;background:#dbeafe;color:#1e40af;border-radius:20px;padding:1px 8px;font-weight:700">O meu voto: ' + (myVote.vote === 'favor' ? 'A favor' : myVote.vote === 'contra' ? 'Contra' : 'Abstencao') + '</span>'
      : '';

    return '<div class="card" style="margin-bottom:10px;cursor:pointer" onclick="openAgendaDetail(\'' + topic.id + '\')">'
      + '<div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">'
        + '<div style="flex:1">'
          + '<div style="font-weight:700;font-size:.95rem;margin-bottom:4px">' + esc(topic.title) + '</div>'
          + '<div style="font-size:.78rem;color:var(--muted)">Por ' + esc(prof.full_name || '?') + ' &middot; ' + fmtDate(topic.created_at) + '</div>'
          + voteBar
          + (topic.conclusion ? '<div style="margin-top:8px;font-size:.82rem;background:#f0fdf4;border-left:3px solid var(--success);padding:6px 10px;border-radius:4px"><strong>Conclusao:</strong> ' + esc(topic.conclusion) + '</div>' : '')
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">'
          + '<span class="badge" style="background:' + statusColor + '20;color:' + statusColor + '">' + ASTATUS_PT[topic.status] + '</span>'
          + myVoteBadge
        + '</div>'
      + '</div>'
      + '</div>';
  }).join('');
}

function openAgendaModal(){
  clearAlert('agenda-err');
  $i('ag-title').value = ''; $i('ag-desc').value = '';
  openModal('agenda-modal');
}

async function saveAgendaTopic(){
  const title = $i('ag-title').value.trim();
  const desc  = $i('ag-desc').value.trim();
  clearAlert('agenda-err');
  if (!title){ showAlert('agenda-err','Insira um titulo.'); return; }
  const r = await sb.from('agenda_topics').insert({condominium_id: CFG_CONDO_ID, title, description: desc || null, created_by: currentProfile.id});
  if (r.error){ showAlert('agenda-err','Erro: ' + r.error.message); return; }
  closeModal('agenda-modal');
  await loadAgenda(); renderAgenda();
  showToast('Topico submetido!', 'success');
}

async function openAgendaDetail(id){
  const topic = agendaTopics.find(t => t.id === id); if (!topic) return;
  const votes = agendaVotes.filter(v => v.topic_id === id);
  const favor = votes.filter(v => v.vote === 'favor').length;
  const contra = votes.filter(v => v.vote === 'contra').length;
  const abst = votes.filter(v => v.vote === 'abstencao').length;
  const myVote = votes.find(v => v.profile_id === currentProfile.id);
  const prof = topic.profiles || {};
  const canDelete = isAdmin() || topic.created_by === currentProfile.id;

  const btnStyle = v => myVote && myVote.vote === v ? 'btn-primary' : 'btn-secondary';
  const voteSection = topic.status !== 'decided'
    ? '<div style="margin:16px 0">'
      + '<div style="font-weight:700;font-size:.85rem;margin-bottom:10px">O teu voto:</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + '<button class="btn btn-sm ' + btnStyle('favor') + '" onclick="castVote(\'' + id + '\',\'favor\')">✓ A favor</button>'
      + '<button class="btn btn-sm ' + btnStyle('contra') + '" onclick="castVote(\'' + id + '\',\'contra\')">✗ Contra</button>'
      + '<button class="btn btn-sm ' + btnStyle('abstencao') + '" onclick="castVote(\'' + id + '\',\'abstencao\')">~ Abstencao</button>'
      + '</div></div>'
    : '';

  const statusBtns = isAdmin()
    ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">'
      + (topic.status !== 'open'    ? '<button class="btn btn-xs btn-secondary" onclick="setAgendaStatus(\'' + id + '\',\'open\')">Em aberto</button>' : '')
      + (topic.status !== 'voting'  ? '<button class="btn btn-xs btn-warn" onclick="setAgendaStatus(\'' + id + '\',\'voting\')">Abrir votacao</button>' : '')
      + (topic.status !== 'decided' ? '<button class="btn btn-xs btn-primary" onclick="setAgendaStatus(\'' + id + '\',\'decided\')">Marcar decidido</button>' : '')
      + (canDelete ? '<button class="btn btn-xs btn-danger" onclick="deleteAgendaTopic(\'' + id + '\')">Apagar</button>' : '')
      + '</div>'
    : '';

  let conclusionSection = '';
  if (isAdmin()){
    conclusionSection = '<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">'
      + '<div style="font-weight:700;font-size:.85rem;margin-bottom:8px">Conclusao / Notas (admin)</div>'
      + '<textarea id="ag-conclusion" style="width:100%;min-height:80px;font-size:.85rem" placeholder="Ex: Aprovado por maioria — avanca em marco">' + esc(topic.conclusion || '') + '</textarea>'
      + '<button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="saveConclusion(\'' + id + '\')">Guardar conclusao</button>'
      + '</div>';
  } else if (topic.conclusion){
    conclusionSection = '<div style="margin-top:14px;background:#f0fdf4;border-left:3px solid var(--success);padding:10px 14px;border-radius:6px">'
      + '<div style="font-weight:700;font-size:.82rem;margin-bottom:4px">Conclusao:</div>'
      + '<div style="font-size:.85rem">' + esc(topic.conclusion) + '</div>'
      + '</div>';
  }

  const totalVotes = favor + contra + abst;
  $i('agenda-detail-content').innerHTML =
    '<h2 style="padding-right:24px">' + esc(topic.title) + '</h2>'
    + '<div style="font-size:.78rem;color:var(--muted);margin:4px 0 12px">Por ' + esc(prof.full_name || '?') + ' &middot; ' + fmtDate(topic.created_at)
      + ' &middot; <span style="font-weight:700;color:' + ASTATUS_COLOR[topic.status] + '">' + ASTATUS_PT[topic.status] + '</span></div>'
    + (topic.description ? '<p style="font-size:.87rem;line-height:1.6;margin-bottom:12px">' + esc(topic.description) + '</p>' : '')
    + (totalVotes > 0
      ? '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:4px">'
        + '<span style="color:var(--success);font-weight:700">✓ A favor: ' + favor + '</span>'
        + '<span style="color:var(--danger);font-weight:700">✗ Contra: ' + contra + '</span>'
        + '<span style="color:var(--muted);font-weight:700">~ Abstencao: ' + abst + '</span>'
        + '<span style="color:var(--muted)">Total: ' + totalVotes + ' votos</span>'
        + '</div>'
      : '')
    + voteSection
    + statusBtns
    + conclusionSection;

  openModal('agenda-detail-modal');
}

async function castVote(topicId, vote){
  const existing = agendaVotes.find(v => v.topic_id === topicId && v.profile_id === currentProfile.id);
  let r;
  if (existing){
    if (existing.vote === vote){
      r = await sb.from('agenda_votes').delete().eq('id', existing.id);
    } else {
      r = await sb.from('agenda_votes').update({vote}).eq('id', existing.id);
    }
  } else {
    r = await sb.from('agenda_votes').insert({topic_id: topicId, profile_id: currentProfile.id, vote});
  }
  if (r && r.error){ showToast('Erro: ' + r.error.message, 'error'); return; }
  await loadAgenda();
  renderAgenda();
  openAgendaDetail(topicId);
}

async function setAgendaStatus(id, status){
  const r = await sb.from('agenda_topics').update({status}).eq('id', id);
  if (r.error){ showToast('Erro: ' + r.error.message, 'error'); return; }
  await loadAgenda(); renderAgenda();
  openAgendaDetail(id);
}

async function saveConclusion(id){
  const conclusion = ($i('ag-conclusion').value || '').trim() || null;
  const r = await sb.from('agenda_topics').update({conclusion}).eq('id', id);
  if (r.error){ showToast('Erro: ' + r.error.message, 'error'); return; }
  await loadAgenda(); renderAgenda();
  openAgendaDetail(id);
  showToast('Conclusao guardada!', 'success');
}

async function deleteAgendaTopic(id){
  if (!confirm('Apagar este topico?')) return;
  const r = await sb.from('agenda_topics').delete().eq('id', id);
  if (r.error){ showToast('Erro: ' + r.error.message, 'error'); return; }
  closeModal('agenda-detail-modal');
  await loadAgenda(); renderAgenda();
  showToast('Apagado.', 'info');
}
