// Global Supabase client and session
let sb = null, currentUser = null, currentProfile = null, currentCondo = null;

// Calendar
let selectedDate = null, selectedSlot = null;
let calData = {};
let calViewYear = 0, calViewMonth = 0;

// Presence
let presenceChannel = null, onlineUsers = {};

// Issues
let allIssues = [], issueFilter = 'open';

// Quotas
let quotaFractions = [], quotaPayments = [];
let quotaYear = new Date().getFullYear();
let editingFractionId = null;

// Cleaning
let cleaningRecords = [], cleaningYear = new Date().getFullYear();

// Utilities
let utilityBills = [], utilitiesYear = new Date().getFullYear();

// Summary / Cashbook
let cashbookEntries = [], summaryYear = new Date().getFullYear();
let _cbEditingId = null;

// Agenda
let agendaTopics = [], agendaVotes = [], agendaFilter = 'open';

// Modal helpers
let _clModalMonth = 0, _utModalMonth = 0, _utEditingId = null;
let _pmModalFracId = null, _pmModalMonth = null;

// Tab
let currentTab = 'meetings';
