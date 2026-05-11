// ── Slug / routing ────────────────────────────────────────────

function getSlugFromUrl() {
  // Suporta:
  //   hash:  #c/edificio-solar  (GitHub Pages — sem 404)
  //   path:  /c/edificio-solar  (servidor próprio)
  const fromHash = location.hash.match(/^#c\/([a-z0-9-]+)/);
  if (fromHash) return fromHash[1];
  const fromPath = location.pathname.match(/\/c\/([a-z0-9-]+)/);
  return fromPath ? fromPath[1] : null;
}

async function resolveSlug(slug) {
  const { data, error } = await sb.from('condominiums').select('*').eq('slug', slug).single();
  if (error || !data) return null;
  return data;
}

function applyBranding(condo) {
  const root = document.documentElement;
  root.style.setProperty('--primary',   condo.primary_color   || '#2d6a4f');
  root.style.setProperty('--primary-l', condo.secondary_color || '#52b788');
  root.style.setProperty('--primary-d', condo.dark_color      || '#1b4332');
  root.style.setProperty('--primary-xl',condo.light_color     || '#d8f3dc');
  if (condo.app_name) document.title = condo.app_name;
  // Mostrar nome do condomínio no ecrã de registo
  const regTitle = $i('reg-condo-name');
  if (regTitle) regTitle.textContent = condo.name;
}

async function loadFractionsForRegister() {
  if (!CFG_CONDO_ID) return;
  // Usa a função RPC pública que não requer autenticação
  const { data } = await sb.from('quota_fractions')
    .select('fraction, description, sort_order')
    .eq('condominium_id', CFG_CONDO_ID)
    .order('sort_order');
  const sel = $i('r-fraction');
  if (!sel) return;
  if (!data?.length) {
    sel.innerHTML = '<option value="">Sem frações disponíveis</option>';
    return;
  }
  sel.innerHTML = data.map(f =>
    `<option value="${esc(f.fraction)}">${esc(f.fraction)}${f.description ? ' — ' + esc(f.description) : ''}</option>`
  ).join('');
}

// ── Tabs ──────────────────────────────────────────────────────

function switchTab(tab) {
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

// ── Presence ──────────────────────────────────────────────────

function startPresence() {
  presenceChannel = sb.channel(`presence:${CFG_CONDO_ID}`, { config: { presence: { key: currentUser.id } } });
  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      onlineUsers = {};
      Object.entries(state).forEach(([uid, p]) => {
        if (p[0]) onlineUsers[uid] = { name: p[0].name, fraction: p[0].fraction };
      });
      renderOnline();
    })
    .subscribe(async s => {
      if (s === 'SUBSCRIBED')
        await presenceChannel.track({ name: currentProfile.full_name, fraction: currentProfile.fraction || '' });
    });
}

function renderOnline() {
  const wrap = $i('online-wrap'), chips = $i('online-chips');
  const all = Object.entries(onlineUsers);
  if (!all.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  chips.innerHTML = all.map(([uid, u]) =>
    `<span class="online-chip"><span class="online-dot"></span>${esc(u.name)}${u.fraction ? ' (' + esc(u.fraction) + ')' : ''}${uid === currentUser.id ? ' <em style="opacity:.6;font-weight:400">(eu)</em>' : ''}</span>`
  ).join('');
}

// ── Render ────────────────────────────────────────────────────

function renderApp() {
  $i('hdr-condo').textContent = currentCondo?.name || 'CondoApp';
  $i('hdr-user').textContent  = `${currentProfile.full_name} · ${currentProfile.fraction || '—'}`;
  $i('hdr-admin-btn').style.display = isAdmin() ? 'flex' : 'none';
  if (isAdmin()) $i('btn-add-fraction').style.display = '';
  const now = new Date(); calViewYear = now.getFullYear(); calViewMonth = now.getMonth();
  renderMiniCal(); renderTopSlots();
  showScreen('app-screen');
  startPresence();
}

// ── Boot ──────────────────────────────────────────────────────

let _loading = false;

async function bootSession(session) {
  if (_loading) return; _loading = true;
  showLoading('A carregar...');
  try {
    currentUser = session.user;
    currentProfile = await loadProfile(currentUser.id);

    // Garantir que o utilizador está associado ao tenant correto
    if (CFG_CONDO_ID && !currentProfile.condominium_id) {
      await sb.from('profiles').update({ condominium_id: CFG_CONDO_ID }).eq('id', currentUser.id);
      currentProfile.condominium_id = CFG_CONDO_ID;
    }

    await Promise.all([loadCalendarData(), loadQuotas(), loadIssues(), loadCleaning(), loadUtilities(), loadCashbook(), loadAgenda()]);
    hideLoading();
    renderApp();
  } catch (e) {
    hideLoading(); showToast('Erro: ' + e.message, 'error');
    await sb.auth.signOut(); showScreen('login-screen');
  } finally { _loading = false; }
}

// ── Polling (com fix de sessão expirada) ──────────────────────

let _pollInterval = null;

function startPolling() {
  if (_pollInterval) clearInterval(_pollInterval);
  _pollInterval = setInterval(async () => {
    if (!currentUser || !$i('app-screen').classList.contains('active')) return;
    await Promise.all([loadCalendarData(), loadQuotas(), loadIssues(), loadCleaning(), loadUtilities(), loadCashbook(), loadAgenda()]);
    renderMiniCal(); renderTopSlots();
    if (selectedDate) renderAvailPanel(selectedDate);
    if (selectedDate && selectedSlot) renderSidePanel(selectedDate, selectedSlot);
    if (currentTab === 'quotas') renderQuotas();
    if (currentTab === 'issues') renderIssues();
  }, 30000);
}

// Fix: quando o utilizador volta ao tab após inatividade, verificar sessão
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !currentUser) return;
  const { data: { session }, error } = await sb.auth.getSession();
  if (error || !session) {
    // Sessão expirada — limpar estado e pedir login
    currentUser = currentProfile = currentCondo = null;
    showToast('Sessão expirada. Faz login novamente.', 'error');
    showScreen('login-screen');
    return;
  }
  // Forçar refresh do token se está próximo de expirar
  await sb.auth.refreshSession();
});

// ── Init ──────────────────────────────────────────────────────

async function init() {
  sb = supabase.createClient(CFG_URL, CFG_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  // Resolver o slug do URL
  const slug = getSlugFromUrl();
  if (slug) {
    CFG_SLUG = slug;
    const condo = await resolveSlug(slug);
    if (condo) {
      CFG_CONDO_ID = condo.id;
      currentCondo = condo;
      applyBranding(condo);
      loadFractionsForRegister();
    } else {
      // Slug desconhecido — mostrar erro
      document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666">
        <div style="text-align:center"><h2>Condomínio não encontrado</h2><p>O endereço <strong>/c/${slug}</strong> não existe.</p></div>
      </div>`;
      return;
    }
  }
  // Se não há slug no URL (ex: acesso direto ao index.html durante desenvolvimento),
  // a app mostra o login mas CFG_CONDO_ID ficará null até ser definido noutra via

  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) await bootSession(session);
  else showScreen('login-screen');

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') { showScreen('forgot-screen'); return; }
    if (event === 'SIGNED_IN') await bootSession(session);
    if (event === 'SIGNED_OUT') {
      currentUser = currentProfile = currentCondo = null;
      calData = {}; quotaFractions = []; quotaPayments = []; allIssues = []; cleaningRecords = [];
      utilityBills = []; cashbookEntries = []; agendaTopics = []; agendaVotes = [];
      selectedDate = null; selectedSlot = null; onlineUsers = {};
      showScreen('login-screen');
    }
  });

  startPolling();
}

document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
});

init();
