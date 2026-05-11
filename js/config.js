// Supabase connection
const CFG_URL      = 'https://nvyxskcwtcqsjpbdoaha.supabase.co';
const CFG_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eXhza2N3dGNxc2pwYmRvYWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMDA5MDAsImV4cCI6MjA5Mzc3NjkwMH0.R0uVQulBLUljAfQ-SlFZe7NLj9EJIJTZ4qKqUxJJzwo';
const CFG_CONDO_ID = '6fde2f8c-ac01-4677-a2e6-6f9beaea47f3';
const CFG_ADMIN_EMAIL = '';

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
