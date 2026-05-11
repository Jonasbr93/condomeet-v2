// Supabase connection — projeto prod multi-tenant
const CFG_URL = 'https://kduhyroeubmzkxffavhb.supabase.co';
const CFG_KEY = 'sb_publishable_HzyViEVan1e1A_SVFPk_lA_EEQXlZYD';

// Resolvido dinamicamente em runtime a partir do slug na URL (/c/:slug/...)
// Não há mais CFG_CONDO_ID fixo — ver resolveSlug() em app.js
let CFG_SLUG     = null;  // slug atual (ex: "edificio-solar")
let CFG_CONDO_ID = null;  // uuid do condomínio, preenchido após resolveSlug()

// Utility
function ph(n){ return String(n).padStart(2,'0'); }

const TIME_SLOTS = (() => {
  const s = [];
  for (let h = 8; h < 23; h++) { s.push(`${ph(h)}:00`); s.push(`${ph(h)}:30`); }
  s.push('23:00'); return s;
})();

// Label maps
const ROLES_PT   = { admin:'Admin', resident:'Morador' };
const STATUS_PT  = { paid:'Paga', pending:'Pendente', overdue:'Em atraso', payment_requested:'A confirmar' };
const ISTATUS_PT = { open:'Aberta', in_progress:'Em curso', resolved:'Resolvida' };

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const ASTATUS_PT    = { open:'Em aberto', voting:'Em votacao', decided:'Decidido' };
const ASTATUS_COLOR = { open:'var(--info)', voting:'var(--warn)', decided:'var(--success)' };
