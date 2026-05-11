async function loadProfile(uid){
  const {data, error} = await sb.from('profiles').select('*').eq('id', uid).single();
  if (error) throw new Error('Perfil não encontrado: ' + error.message);
  return data;
}

async function loadCalendarData(){
  calData = {};
  const {data: dates} = await sb.from('calendar_dates').select('*').eq('condominium_id', CFG_CONDO_ID);
  if (!dates?.length) return;
  const {data: avails} = await sb.from('availabilities')
    .select('id, calendar_date_id, profile_id, time_slot, note, profiles(id,full_name,fraction,role)')
    .in('calendar_date_id', dates.map(d => d.id));
  dates.forEach(d => { calData[d.date] = {dateId: d.id, slots: {}}; TIME_SLOTS.forEach(t => calData[d.date].slots[t] = []); });
  (avails || []).forEach(a => {
    const entry = Object.values(calData).find(e => e.dateId === a.calendar_date_id);
    if (entry && entry.slots[a.time_slot]) entry.slots[a.time_slot].push(a);
  });
}

async function loadQuotas(){
  const {data: fracs} = await sb.from('quota_fractions').select('*').eq('condominium_id', CFG_CONDO_ID).order('sort_order').order('fraction');
  quotaFractions = fracs || [];
  const fracIds = quotaFractions.map(f => f.id);
  if (fracIds.length){
    const {data: pmts} = await sb.from('quota_payments').select('*').in('fraction_id', fracIds).eq('year', quotaYear);
    quotaPayments = pmts || [];
  } else { quotaPayments = []; }
  if (isAdmin()){
    const pending = quotaPayments.filter(p => p.status === 'payment_requested').length;
    $i('quotas-badge').textContent = pending;
    $i('quotas-badge').style.display = pending > 0 ? '' : 'none';
  }
}

async function loadIssues(){
  const {data} = await sb.from('issues')
    .select('*, profiles(id,full_name,fraction)')
    .eq('condominium_id', CFG_CONDO_ID)
    .order('created_at', {ascending: false});
  allIssues = data || [];
  const open = allIssues.filter(i => i.status === 'open').length;
  $i('issues-badge').textContent = open;
  $i('issues-badge').style.display = open > 0 ? '' : 'none';
}

async function loadCleaning(){
  const y = cleaningYear;
  const {data} = await sb.from('cleaning_dates').select('*').eq('condominium_id', CFG_CONDO_ID)
    .gte('date', y + '-01-01').lte('date', y + '-12-31').order('date');
  cleaningRecords = data || [];
}

async function loadUtilities(){
  const {data} = await sb.from('utility_bills').select('*').eq('condominium_id', CFG_CONDO_ID).eq('year', utilitiesYear).order('month');
  utilityBills = data || [];
}

async function loadCashbook(){
  const {data} = await sb.from('cashbook').select('*').eq('condominium_id', CFG_CONDO_ID).order('date', {ascending: false});
  cashbookEntries = data || [];
}

async function loadAgenda(){
  const {data: topics} = await sb.from('agenda_topics').select('*, profiles(id,full_name,fraction)')
    .eq('condominium_id', CFG_CONDO_ID).order('created_at', {ascending: false});
  agendaTopics = topics || [];
  const ids = agendaTopics.map(t => t.id);
  if (ids.length){
    const {data: votes} = await sb.from('agenda_votes').select('*').in('topic_id', ids);
    agendaVotes = votes || [];
  } else { agendaVotes = []; }
  const voting = agendaTopics.filter(t => t.status === 'voting').length;
  $i('agenda-badge').textContent = voting;
  $i('agenda-badge').style.display = voting > 0 ? '' : 'none';
}
