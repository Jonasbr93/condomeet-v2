async function doLogin(){
  const email = $i('l-email').value.trim(), pw = $i('l-pw').value;
  clearAlert('login-err');
  if (!email || !pw){ showAlert('login-err','Preencha email e password.'); return; }
  showLoading('A entrar...');
  const {error} = await sb.auth.signInWithPassword({email, password: pw});
  if (error){ hideLoading(); showAlert('login-err', xlateErr(error.message)); }
}

async function doRegister(){
  const name     = $i('r-name').value.trim();
  const fraction = $i('r-fraction').value.trim();
  const email    = $i('r-email').value.trim();
  const pw       = $i('r-pw').value;
  const pw2      = $i('r-pw2').value;
  clearAlert('reg-err');
  if (!name)      { showAlert('reg-err','Insira o seu nome.'); return; }
  if (!fraction)  { showAlert('reg-err','Selecione a sua fração.'); return; }
  if (!email)     { showAlert('reg-err','Insira o seu email.'); return; }
  if (pw.length < 6){ showAlert('reg-err','Password mínimo 6 caracteres.'); return; }
  if (pw !== pw2) { showAlert('reg-err','As passwords não coincidem.'); return; }

  // Verificar se a fração ainda tem vagas (max 2 utilizadores por fração)
  showLoading('A verificar fração...');
  const {data: check, error: checkErr} = await sb.rpc('check_fraction_registration', {p_condo_id: CFG_CONDO_ID, p_fraction: fraction});
  if (checkErr || !check){
    hideLoading();
    showAlert('reg-err','Erro ao verificar fração. Tente novamente.');
    return;
  }
  if (!check.ok){
    hideLoading();
    if (check.error === 'fraction_not_found')
      showAlert('reg-err', `A fração "${fraction}" não existe neste condomínio.`);
    else if (check.error === 'fraction_full')
      showAlert('reg-err', `A fração "${fraction}" já atingiu o limite de 2 utilizadores. Contacte o administrador.`);
    else
      showAlert('reg-err','Não foi possível registar. Contacte o administrador.');
    return;
  }

  const meta = { full_name: name, fraction, role: 'resident', condominium_id: CFG_CONDO_ID };
  showLoading('A criar conta...');
  const {error} = await sb.auth.signUp({email, password: pw, options: {data: meta}});
  if (error){ hideLoading(); showAlert('reg-err', xlateErr(error.message)); return; }
  const {error: le} = await sb.auth.signInWithPassword({email, password: pw});
  if (le){ hideLoading(); showAlert('reg-err','✅ Conta criada! Faça login.','success'); return; }
  const uid = (await sb.auth.getUser()).data.user.id;
  await sb.from('profiles').update({full_name: name, fraction, condominium_id: CFG_CONDO_ID}).eq('id', uid);
  hideLoading();
}

async function doForgot(){
  const email = $i('f-email').value.trim();
  clearAlert('forgot-err'); clearAlert('forgot-ok');
  if (!email){ showAlert('forgot-err','Insira o seu email.'); return; }
  showLoading('A enviar...');
  const {error} = await sb.auth.resetPasswordForEmail(email, {redirectTo: window.location.href});
  hideLoading();
  if (error){ showAlert('forgot-err', xlateErr(error.message)); return; }
  showAlert('forgot-ok','Email enviado!','success');
}

async function doLogout(){
  showLoading('A sair...');
  if (presenceChannel){ await sb.removeChannel(presenceChannel); presenceChannel = null; }
  await sb.auth.signOut();
  hideLoading();
}

function xlateErr(msg){
  if (msg.includes('Invalid login'))       return 'Email ou password incorretos.';
  if (msg.includes('Email not confirmed')) return 'Confirme o email antes de entrar.';
  if (msg.includes('already registered'))  return 'Email já registado.';
  if (msg.includes('rate limit'))          return 'Demasiadas tentativas. Aguarde.';
  return msg;
}
