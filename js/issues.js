function setIssueFilter(f){
  issueFilter = f;
  ['open','in_progress','resolved','all'].forEach(x => {
    const btn = $i(`ifilter-${x}`);
    btn.className = x === f ? 'btn btn-sm' : 'btn btn-secondary btn-sm';
    if (x === f) btn.style.background = 'var(--primary)', btn.style.color = '#fff';
    else btn.style.background = '', btn.style.color = '';
  });
  renderIssues();
}

function renderIssues(){
  const list = issueFilter === 'all' ? allIssues : allIssues.filter(i => i.status === issueFilter);
  if (!list.length){
    $i('issues-list').innerHTML = `<div class="empty-state"><div class="ei">✅</div>${issueFilter === 'open' ? 'Sem ocorrências abertas.' : 'Sem resultados.'}</div>`;
    return;
  }
  const myId = currentProfile.id;
  $i('issues-list').innerHTML = list.map(issue => {
    const prof = issue.profiles || {};
    const name = prof.full_name || '?';
    const stBadge = badge(issue.status, ISTATUS_PT[issue.status] || issue.status);
    const costTag = issue.cost ? `<span style="font-size:.75rem;background:#fef3c7;color:#92400e;border-radius:20px;padding:1px 8px;font-weight:700">💰 €${Number(issue.cost).toFixed(2)}</span>` : '';
    const canChange = isAdmin() || issue.created_by === myId;
    const statusActions = canChange ? `<div style="display:flex;gap:5px;margin-top:10px;flex-wrap:wrap">
      ${issue.status !== 'in_progress' ? `<button class="btn btn-xs btn-warn" onclick="event.stopPropagation();setIssueStatus('${issue.id}','in_progress')">▶ Em curso</button>` : ''}
      ${issue.status !== 'resolved' ? `<button class="btn btn-xs btn-primary" onclick="event.stopPropagation();setIssueStatus('${issue.id}','resolved')">✓ Resolver</button>` : ''}
      ${issue.status !== 'open' ? `<button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();setIssueStatus('${issue.id}','open')">↩ Reabrir</button>` : ''}
    </div>` : '';
    return `<div class="issue-card" onclick="openIssueDetail('${issue.id}')">
      <div class="ic-top">
        <div style="flex:1">
          <div class="ic-title">${esc(issue.title)}</div>
          <div class="ic-meta" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px">Por ${esc(name)} · ${fmtDateTime(issue.created_at)} ${stBadge} ${costTag}</div>
        </div>
      </div>
      ${issue.description ? `<div class="ic-desc">${esc(issue.description)}</div>` : ''}
      ${statusActions}
    </div>`;
  }).join('');
}

function openNewIssueModal(){
  clearAlert('issue-err');
  $i('is-title').value = ''; $i('is-desc').value = '';
  openModal('issue-modal');
}

async function saveNewIssue(){
  const title = $i('is-title').value.trim(), desc = $i('is-desc').value.trim();
  clearAlert('issue-err');
  if (!title){ showAlert('issue-err','Insira um título.'); return; }
  showLoading('A submeter...');
  const {error} = await sb.from('issues').insert({condominium_id: CFG_CONDO_ID, title, description: desc || null, created_by: currentProfile.id});
  hideLoading();
  if (error){ showAlert('issue-err','Erro: ' + error.message); return; }
  closeModal('issue-modal');
  await loadIssues(); renderIssues();
  showToast('Ocorrência submetida!', 'success');
}

async function openIssueDetail(id){
  const issue = allIssues.find(i => i.id === id); if (!issue) return;
  const {data: comments} = await sb.from('issue_comments')
    .select('*, profiles(id,full_name,fraction)').eq('issue_id', id).order('created_at');
  const prof = issue.profiles || {};
  const myId = currentProfile.id;
  const stBadge = badge(issue.status, ISTATUS_PT[issue.status] || issue.status);
  const canEdit = isAdmin() || issue.created_by === myId;

  const statusBtns = canEdit ? `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
      ${issue.status !== 'open' ? `<button class="btn btn-xs btn-secondary" onclick="setIssueStatus('${id}','open')">↩ Reabrir</button>` : ''}
      ${issue.status !== 'in_progress' ? `<button class="btn btn-xs btn-warn" onclick="setIssueStatus('${id}','in_progress')">▶ Em curso</button>` : ''}
      ${issue.status !== 'resolved' ? `<button class="btn btn-xs btn-primary" onclick="setIssueStatus('${id}','resolved')">✓ Resolver</button>` : ''}
      ${canEdit ? `<button class="btn btn-xs btn-danger" onclick="deleteIssue('${id}')">🗑️ Apagar</button>` : ''}
    </div>` : '';

  const costSection = isAdmin() ? `
    <div style="background:#fafafa;border:1px solid var(--border);border-radius:8px;padding:14px;margin:14px 0">
      <div style="font-weight:700;font-size:.84rem;margin-bottom:10px">💰 Custo associado</div>
      <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
        <div class="form-group" style="margin:0;flex:0 0 120px">
          <label style="font-size:.75rem">Valor (€)</label>
          <input type="number" id="ic-cost" value="${issue.cost || ''}" min="0" step="0.01" placeholder="0.00" style="font-size:.84rem;padding:7px 10px">
        </div>
        <div class="form-group" style="margin:0;flex:1;min-width:160px">
          <label style="font-size:.75rem">Descrição do custo</label>
          <input type="text" id="ic-cost-desc" value="${esc(issue.cost_description || '')}" placeholder="Ex: Mão de obra, peças..." style="font-size:.84rem;padding:7px 10px">
        </div>
        <button class="btn btn-secondary btn-sm" style="margin-top:20px" onclick="saveCost('${id}')">Guardar</button>
      </div>
      ${issue.cost ? `<div style="margin-top:8px;font-size:.82rem;color:var(--muted)">Custo atual: <strong style="color:var(--text)">€${Number(issue.cost).toFixed(2)}</strong>${issue.cost_description ? ' — ' + esc(issue.cost_description) : ''}</div>` : ''}
    </div>` : '';

  const resolvedInfo = issue.resolved_at ? `<div style="font-size:.78rem;color:var(--success);margin-top:4px">✓ Resolvida em ${fmtDateTime(issue.resolved_at)}</div>` : '';

  const commentsHtml = (comments || []).map(c => {
    const cp = c.profiles || {};
    const isMe = c.profile_id === myId;
    return `<div class="comment">
      <div class="c-av${isMe ? ' me' : ''}">${initials(cp.full_name)}</div>
      <div class="c-bubble">
        <div class="c-header">
          <span class="c-name">${esc(cp.full_name || '?')}</span>
          <span class="c-time">${fmtDateTime(c.created_at)}</span>
          ${isMe || isAdmin() ? `<button class="c-del" onclick="deleteComment('${c.id}','${id}')">✕</button>` : ''}
        </div>
        <div class="c-body">${esc(c.body)}</div>
      </div>
    </div>`;
  }).join('');

  $i('issue-detail-content').innerHTML = `
    <h2 style="padding-right:24px">${esc(issue.title)}</h2>
    <div style="font-size:.8rem;color:var(--muted);margin-bottom:4px">
      Por ${esc(prof.full_name || '?')} · ${fmtDateTime(issue.created_at)} · ${stBadge}
    </div>
    ${resolvedInfo}
    ${issue.description ? `<p style="font-size:.87rem;color:var(--text);margin:10px 0 0;line-height:1.6">${esc(issue.description)}</p>` : ''}
    ${statusBtns}
    ${costSection}
    <hr style="border:none;border-top:1px solid var(--border);margin:16px 0">
    <div style="font-weight:700;font-size:.85rem;margin-bottom:12px">Comentários (${(comments || []).length})</div>
    <div id="comments-list-${id}">${commentsHtml || '<div style="color:var(--muted);font-size:.84rem;margin-bottom:12px">Sem comentários ainda.</div>'}</div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <textarea id="new-comment-${id}" placeholder="Adicionar comentário..." style="flex:1;min-height:60px;font-size:.84rem"></textarea>
    </div>
    <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="addComment('${id}')">Enviar</button>`;
  openModal('issue-detail-modal');
}

async function addComment(issueId){
  const body = ($i(`new-comment-${issueId}`)?.value || '').trim();
  if (!body){ showToast('Escreva um comentário.','info'); return; }
  const {error} = await sb.from('issue_comments').insert({issue_id: issueId, profile_id: currentProfile.id, body});
  if (error){ showToast('Erro: ' + error.message, 'error'); return; }
  $i(`new-comment-${issueId}`).value = '';
  await openIssueDetail(issueId);
  showToast('Comentário adicionado!', 'success');
}

async function deleteComment(commentId, issueId){
  if (!confirm('Apagar comentário?')) return;
  const {error} = await sb.from('issue_comments').delete().eq('id', commentId);
  if (error){ showToast('Erro: ' + error.message, 'error'); return; }
  await openIssueDetail(issueId);
}

async function setIssueStatus(id, status){
  const upd = {status};
  if (status === 'resolved') upd.resolved_at = new Date().toISOString();
  if (status !== 'resolved') upd.resolved_at = null;
  const {error} = await sb.from('issues').update(upd).eq('id', id);
  if (error){ showToast('Erro: ' + error.message, 'error'); return; }
  await loadIssues(); renderIssues();
  if ($i('issue-detail-modal').classList.contains('open')) await openIssueDetail(id);
  showToast('Estado atualizado!', 'success');
}

async function saveCost(id){
  const cost = parseFloat($i('ic-cost')?.value) || null;
  const cost_description = ($i('ic-cost-desc')?.value || '').trim() || null;
  const {error} = await sb.from('issues').update({cost, cost_description}).eq('id', id);
  if (error){ showToast('Erro: ' + error.message, 'error'); return; }
  await loadIssues();
  await openIssueDetail(id);
  showToast('Custo guardado!', 'success');
}

async function deleteIssue(id){
  if (!confirm('Apagar esta ocorrência e todos os comentários?')) return;
  showLoading('A apagar...');
  const {error} = await sb.from('issues').delete().eq('id', id);
  hideLoading();
  if (error){ showToast('Erro: ' + error.message, 'error'); return; }
  closeModal('issue-detail-modal');
  await loadIssues(); renderIssues();
  showToast('Ocorrência apagada.', 'info');
}
