const $i = id => document.getElementById(id);

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $i(id).classList.add('active');
}

function showLoading(m = 'A carregar...'){
  $i('loading-msg').textContent = m;
  $i('loading-overlay').classList.add('active');
}

function hideLoading(){ $i('loading-overlay').classList.remove('active'); }

function showToast(msg, type = 'info'){
  const t = $i('toast');
  t.textContent = msg;
  t.className = `show ${type}`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3500);
}

function openModal(id){ $i(id).classList.add('open'); }
function closeModal(id){ $i(id).classList.remove('open'); }

function showAlert(id, msg, type = 'error'){
  const e = $i(id);
  e.textContent = msg;
  e.className = `alert alert-${type} show`;
}

function clearAlert(id){
  const e = $i(id);
  e.className = 'alert';
  e.textContent = '';
}

function esc(s){
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function initials(n){
  return (n || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function badge(cls, txt){
  return `<span class="badge badge-${cls}">${txt}</span>`;
}

function fmtDate(d){
  const [y, m, day] = d.split('-');
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const date = new Date(+y, +m - 1, +day);
  return `${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][date.getDay()]} ${+day} ${months[+m - 1]} ${y}`;
}

function fmtDateTime(ts){
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${ph(d.getHours())}:${ph(d.getMinutes())}`;
}

function isAdmin(){ return currentProfile?.role === 'admin' || currentProfile?.role === 'super_admin'; }
function canAddDates(){ return isAdmin(); }
