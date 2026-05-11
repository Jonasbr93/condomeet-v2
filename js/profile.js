function openProfileModal(){
  clearAlert('profile-err'); clearAlert('profile-ok');
  $i('p-name').value = currentProfile.full_name || '';
  $i('p-fraction').value = currentProfile.fraction || '';
  $i('p-email').value = currentUser.email || '';
  $i('p-pw').value = '';
  $i('p-role-display').innerHTML = badge(currentProfile.role, ROLES_PT[currentProfile.role] || currentProfile.role);
  openModal('profile-modal');
}

async function saveProfile(){
  const name = $i('p-name').value.trim(), fraction = $i('p-fraction').value.trim().toUpperCase(), pw = $i('p-pw').value;
  clearAlert('profile-err'); clearAlert('profile-ok');
  if (!name){ showAlert('profile-err','O nome não pode estar vazio.'); return; }
  showLoading('A guardar...');
  const {error} = await sb.from('profiles').update({full_name: name, fraction}).eq('id', currentProfile.id);
  if (error){ hideLoading(); showAlert('profile-err','Erro: ' + error.message); return; }
  if (pw){
    if (pw.length < 6){ hideLoading(); showAlert('profile-err','Password mínimo 6 caracteres.'); return; }
    const {error: pe} = await sb.auth.updateUser({password: pw});
    if (pe){ hideLoading(); showAlert('profile-err','Erro: ' + pe.message); return; }
  }
  currentProfile.full_name = name; currentProfile.fraction = fraction;
  hideLoading(); showAlert('profile-ok','Perfil atualizado.','success');
  $i('hdr-user').textContent = `${name} · ${fraction || '—'}`;
  if (presenceChannel) presenceChannel.track({name, fraction});
}

async function openAdminModal(){
  $i('users-loading').style.display = 'block'; $i('users-list').style.display = 'none';
  openModal('admin-modal');
  const {data} = await sb.from('profiles').select('*').eq('condominium_id', CFG_CONDO_ID).order('full_name');
  $i('users-loading').style.display = 'none';
  if (!data) return;

  const admins = data.filter(u => u.role === 'admin' || u.role === 'super_admin');
  const residents = data.filter(u => u.role === 'resident');

  function memberCard(u){
    const isMe = u.id === currentUser.id;
    const roleColor = u.role === 'admin' || u.role === 'super_admin' ? 'var(--primary-d)' : 'var(--muted)';
    const roleLabel = ROLES_PT[u.role] || u.role;
    const ini = (u.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const since = u.created_at ? fmtDate(u.created_at) : '';
    const actions = isMe
      ? '<span style="font-size:.78rem;color:var(--muted);font-style:italic">Eu</span>'
      : `<select onchange="changeRole('${u.id}',this.value)"
           style="font-size:.8rem;padding:4px 8px;border-radius:6px;border:1.5px solid var(--border);background:#fff;cursor:pointer">
           ${['admin','resident'].map(r => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${ROLES_PT[r]}</option>`).join('')}
         </select>`;
    return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="width:38px;height:38px;border-radius:50%;background:${u.role === 'admin' || u.role === 'super_admin' ? 'var(--primary)' : 'var(--primary-l)'};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;flex-shrink:0">${ini}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:.9rem">${esc(u.full_name || '(sem nome)')}${isMe ? ' <span style="font-size:.72rem;background:#dbeafe;color:#1e40af;border-radius:20px;padding:1px 7px">Eu</span>' : ''}</div>
        <div style="font-size:.76rem;color:var(--muted);margin-top:2px">
          ${u.fraction ? `Fração ${esc(u.fraction)} &middot; ` : ''}
          <span style="color:${roleColor};font-weight:600">${roleLabel}</span>
          ${since ? ` &middot; desde ${since}` : ''}
        </div>
      </div>
      <div style="flex-shrink:0">${actions}</div>
    </div>`;
  }

  let html = '';
  if (admins.length){
    html += `<div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:4px">Administradores (${admins.length})</div>`;
    html += admins.map(memberCard).join('');
  }
  if (residents.length){
    html += `<div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:16px 0 4px">Moradores (${residents.length})</div>`;
    html += residents.map(memberCard).join('');
  }
  if (!data.length) html = '<div class="empty-state">Sem membros.</div>';

  $i('users-list').innerHTML = html;
  $i('users-list').style.display = '';
}

async function changeRole(uid, role){
  const {error} = await sb.from('profiles').update({role}).eq('id', uid);
  if (error){ showToast('Erro: ' + error.message, 'error'); return; }
  showToast('Role atualizado.', 'success');
  openAdminModal();
}
