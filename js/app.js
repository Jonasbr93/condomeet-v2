function switchTab(tab){
  currentTab = tab;
  ['meetings','quotas','issues','cleaning','utilities','summary','agenda'].forEach(t => {
    $i(`nav-${t}`).classList.toggle('active', t === tab);
    $i(`tab-${t}`).style.display = t === tab ? '' : 'none';
  });
  closeSidePanel();
  if (tab === 'quotas')    renderQuotas();
  if (tab === 'issues')    renderIssues();
  if (tab === 'cleaning')  renderCleaning();
  if (tab === 'utilities') renderUtilities();
  if (tab === 'summary')   { renderSummary(); if (isAdmin()) $i('btn-add-cashbook').style.display = ''; }
  if (tab === 'agenda')    renderAgenda();
}

function startPresence(){
  presenceChannel = sb.channel(`presence:${CFG_CONDO_ID}`, {config: {presence: {key: currentUser.id}}});
  presenceChannel
    .on('presence', {event: 'sync'}, () => {
      const state = presenceChannel.presenceState(); onlineUsers = {};
      Object.entries(state).forEach(([uid, p]) => { if (p[0]) onlineUsers[uid] = {name: p[0].name, fraction: p[0].fraction}; });
      renderOnline();
    })
    .subscribe(async s => { if (s === 'SUBSCRIBED') await presenceChannel.track({name: currentProfile.full_name, fraction: currentProfile.fraction || ''}); });
}

function renderOnline(){
  const wrap = $i('online-wrap'), chips = $i('online-chips');
  const all = Object.entries(onlineUsers);
  if (!all.length){ wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  chips.innerHTML = all.map(([uid, u]) => `<span class="online-chip"><span class="online-dot"></span>${esc(u.name)}${u.fraction ? ' (' + esc(u.fraction) + ')' : ''}${uid === currentUser.id ? ' <em style="opacity:.6;font-weight:400">(eu)</em>' : ''}</span>`).join('');
}

function renderApp(){
  $i('hdr-condo').textContent = currentCondo?.name || 'CondoMeet';
  $i('hdr-user').textContent = `${currentProfile.full_name} · ${currentProfile.fraction || '—'}`;
  $i('hdr-admin-btn').style.display = isAdmin() ? 'flex' : 'none';
  if (isAdmin()) $i('btn-add-fraction').style.display = '';
  const now = new Date(); calViewYear = now.getFullYear(); calViewMonth = now.getMonth();
  renderMiniCal(); renderTopSlots();
  showScreen('app-screen');
  startPresence();
}

let _loading = false;

async function bootSession(session){
  if (_loading) return; _loading = true;
  showLoading('A carregar...');
  try {
    currentUser = session.user;
    currentProfile = await loadProfile(currentUser.id);
    if (!currentProfile.condominium_id){
      await sb.from('profiles').update({condominium_id: CFG_CONDO_ID}).eq('id', currentUser.id);
      currentProfile.condominium_id = CFG_CONDO_ID;
    }
    const {data: condo} = await sb.from('condominiums').select('*').eq('id', CFG_CONDO_ID).single();
    currentCondo = condo || null;
    await Promise.all([loadCalendarData(), loadQuotas(), loadIssues(), loadCleaning(), loadUtilities(), loadCashbook(), loadAgenda()]);
    hideLoading();
    renderApp();
  } catch(e){
    hideLoading(); showToast('Erro: ' + e.message, 'error');
    await sb.auth.signOut(); showScreen('login-screen');
  } finally { _loading = false; }
}

async function init(){
  sb = supabase.createClient(CFG_URL, CFG_KEY, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: false}});
  const {data: {session}} = await sb.auth.getSession();
  if (session?.user) await bootSession(session);
  else showScreen('login-screen');

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY'){ showScreen('forgot-screen'); return; }
    if (event === 'SIGNED_IN') await bootSession(session);
    if (event === 'SIGNED_OUT'){
      currentUser = currentProfile = currentCondo = null;
      calData = {}; quotaFractions = []; quotaPayments = []; allIssues = []; cleaningRecords = []; utilityBills = []; cashbookEntries = []; agendaTopics = []; agendaVotes = [];
      selectedDate = null; selectedSlot = null; onlineUsers = {};
      showScreen('login-screen');
    }
  });

  setInterval(async () => {
    if (!currentUser || !$i('app-screen').classList.contains('active')) return;
    await Promise.all([loadCalendarData(), loadQuotas(), loadIssues(), loadCleaning(), loadUtilities(), loadCashbook(), loadAgenda()]);
    renderMiniCal(); renderTopSlots();
    if (selectedDate) renderAvailPanel(selectedDate);
    if (selectedDate && selectedSlot) renderSidePanel(selectedDate, selectedSlot);
    if (currentTab === 'quotas') renderQuotas();
    if (currentTab === 'issues') renderIssues();
  }, 30000);
}

document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
});

init();
