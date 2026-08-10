(function () {
  'use strict';

  const AI_CACHE_PREFIX = 'bebistakip_ai_';
  const DEFAULT_SETTINGS = {
    babyName: 'Ediz',
    birthDate: '2026-05-14'
  };
  const FIXED_BIRTH_DATE = DEFAULT_SETTINGS.birthDate;
  const FIXED_BIRTH_WEIGHT_G = 3235;
  const FIXED_BIRTH_HEIGHT_CM = 50;
  const GROQ_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
  ];
  const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const AI_LAST_SUCCESS_KEY = 'bebistakip_ai_last_success';
  const AI_DEBOUNCE_MS = 30 * 1000;
  const AI_MIN_GAP_MS = 2 * 60 * 1000;

  const TYPE_CONFIG = {
    sut: { emoji: '🍼', label: 'Süt', color: 'sut' },
    mama: { emoji: '🍶', label: 'Mama', color: 'mama' },
    kaka: { emoji: '💩', label: 'Bez', color: 'kaka' },
    emdi: { emoji: '🤱', label: 'Emzirme', color: 'sut' },
    uyku: { emoji: '😴', label: 'Uyku', color: 'uyku' }
  };

  const ENCOURAGEMENTS = [
    'Harika bir ebeveynsin! 💕',
    'Bebiş şanslı! 🌟',
    'Süpersin anne/baba! 👏',
    'Her kayıt bir sevgi izi 💝',
    'Minik kahramanımız büyüyor! 🌈',
    'Bugün de harika gidiyor! ✨',
    'Takip etmek sevginin göstergesi 💗',
    'Bebiş mutlu, sen de mutlu! 😊'
  ];

  let selectedType = 'sut';
  let selectedPreset = null;
  let selectedEmdiPreset = null;
  let selectedUykuPreset = null;
  let editingEntryId = null;
  let editSelectedType = 'sut';
  let aiLoading = false;
  let currentAdviceSource = 'local';
  let lastAdviceHour = new Date().getHours();
  let lastApiCallAt = 0;
  let aiRefreshTimer = null;
  let firestoreReady = false;

  // DOM
  const els = {
    babyName: document.getElementById('babyName'),
    todayDate: document.getElementById('todayDate'),
    statSut: document.getElementById('statSut'),
    statMama: document.getElementById('statMama'),
    statTotal: document.getElementById('statTotal'),
    statEmdi: document.getElementById('statEmdi'),
    statEmdiCount: document.getElementById('statEmdiCount'),
    statUyku: document.getElementById('statUyku'),
    statUykuCount: document.getElementById('statUykuCount'),
    statKaka: document.getElementById('statKaka'),
    encouragement: document.getElementById('encouragement'),
    feedPanel: document.getElementById('feedPanel'),
    emdiPanel: document.getElementById('emdiPanel'),
    emdiInput: document.getElementById('emdiInput'),
    uykuPanel: document.getElementById('uykuPanel'),
    uykuInput: document.getElementById('uykuInput'),
    bezPanel: document.getElementById('bezPanel'),
    noteInput: document.getElementById('noteInput'),
    amountInput: document.getElementById('amountInput'),
    dateInput: document.getElementById('dateInput'),
    timeInput: document.getElementById('timeInput'),
    addBtn: document.getElementById('addBtn'),
    timelineList: document.getElementById('timelineList'),
    historyList: document.getElementById('historyList'),
    weeklyReportBtn: document.getElementById('weeklyReportBtn'),
    weeklyReportModal: document.getElementById('weeklyReportModal'),
    closeWeeklyReport: document.getElementById('closeWeeklyReport'),
    weeklyChart: document.getElementById('weeklyChart'),
    weeklyReportContent: document.getElementById('weeklyReportContent'),
    copyWeeklyReport: document.getElementById('copyWeeklyReport'),
    shareWeeklyReport: document.getElementById('shareWeeklyReport'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettings: document.getElementById('closeSettings'),
    babyNameInput: document.getElementById('babyNameInput'),
    currentWeightInput: document.getElementById('currentWeightInput'),
    currentHeightInput: document.getElementById('currentHeightInput'),
    saveSettings: document.getElementById('saveSettings'),
    reportModal: document.getElementById('reportModal'),
    closeReport: document.getElementById('closeReport'),
    reportContent: document.getElementById('reportContent'),
    reportEntryList: document.getElementById('reportEntryList'),
    editModal: document.getElementById('editModal'),
    closeEdit: document.getElementById('closeEdit'),
    cancelEdit: document.getElementById('cancelEdit'),
    saveEdit: document.getElementById('saveEdit'),
    editFeedPanel: document.getElementById('editFeedPanel'),
    editEmdiPanel: document.getElementById('editEmdiPanel'),
    editUykuPanel: document.getElementById('editUykuPanel'),
    editBezPanel: document.getElementById('editBezPanel'),
    editAmountInput: document.getElementById('editAmountInput'),
    editEmdiInput: document.getElementById('editEmdiInput'),
    editUykuInput: document.getElementById('editUykuInput'),
    editNoteInput: document.getElementById('editNoteInput'),
    editDateInput: document.getElementById('editDateInput'),
    editTimeInput: document.getElementById('editTimeInput'),
    copyReport: document.getElementById('copyReport'),
    shareReport: document.getElementById('shareReport'),
    toast: document.getElementById('toast'),
    babyAge: document.getElementById('babyAge'),
    aiPlaceholder: document.getElementById('aiPlaceholder'),
    aiContent: document.getElementById('aiContent'),
    aiSourceBadge: document.getElementById('aiSourceBadge')
  };

  // --- Storage (Firestore only) ---

  function loadData() {
    if (window.FirestoreSync && window.FirestoreSync.isReady()) {
      return window.FirestoreSync.getData();
    }
    return { entries: [] };
  }

  function saveData(data) {
    if (!window.FirestoreSync || !window.FirestoreSync.isReady()) return;
    window.FirestoreSync.saveData(data).catch(function () {
      showToast('Kayıt kaydedilemedi ☁️');
    });
  }

  function sanitizeGrowthValue(weightG, heightCm) {
    let safeWeightG = weightG;
    let safeHeightCm = heightCm;
    if (safeWeightG && (safeWeightG < 2000 || safeWeightG > 15000)) safeWeightG = null;
    if (safeHeightCm && (safeHeightCm < 40 || safeHeightCm > 100)) safeHeightCm = null;
    return { currentWeightG: safeWeightG, currentHeightCm: safeHeightCm };
  }

  function loadSettings() {
    const synced = (window.FirestoreSync && window.FirestoreSync.isReady())
      ? window.FirestoreSync.getSettings()
      : { babyName: DEFAULT_SETTINGS.babyName };
    const growth = sanitizeGrowthValue(synced.currentWeightG || null, synced.currentHeightCm || null);
    return {
      babyName: synced.babyName || DEFAULT_SETTINGS.babyName,
      birthDate: FIXED_BIRTH_DATE,
      birthWeightG: FIXED_BIRTH_WEIGHT_G,
      birthHeightCm: FIXED_BIRTH_HEIGHT_CM,
      currentWeightG: growth.currentWeightG,
      currentHeightCm: growth.currentHeightCm,
      groqApiKey: synced.groqApiKey || ''
    };
  }

  function parseWeightKgInput(value) {
    const raw = String(value).trim().replace(',', '.');
    if (!raw) return null;
    const num = parseFloat(raw);
    if (!Number.isFinite(num) || num <= 0) return null;
    if (num > 30) {
      const grams = Math.round(num);
      if (grams < 2000 || grams > 15000) return null;
      return grams;
    }
    if (num < 2 || num > 15) return null;
    return Math.round(num * 1000);
  }

  function formatWeightKgInput(grams) {
    if (!grams) return '';
    return (grams / 1000).toFixed(2);
  }

  function parseHeightCmInput(value) {
    const raw = String(value).trim().replace(',', '.');
    if (!raw) return null;
    const cm = parseFloat(raw);
    if (!Number.isFinite(cm) || cm < 40 || cm > 100) return null;
    return Math.round(cm * 10) / 10;
  }

  function readGrowthInputsFromForm() {
    const heightRaw = els.currentHeightInput ? els.currentHeightInput.value : '';
    const weightRaw = els.currentWeightInput ? els.currentWeightInput.value : '';
    const currentHeightCm = parseHeightCmInput(heightRaw);
    const currentWeightG = parseWeightKgInput(weightRaw);

    if (String(heightRaw).trim() && currentHeightCm === null) {
      return { error: 'Boy 40-100 cm arasında olmalı.' };
    }
    if (String(weightRaw).trim() && currentWeightG === null) {
      return { error: 'Kilo 2-15 kg arasında olmalı (gram için 2000-15000).' };
    }

    return { currentHeightCm: currentHeightCm, currentWeightG: currentWeightG, error: null };
  }

  function formatGrowthContext(settings) {
    const birthText = 'Doğum (14 Mayıs 2026): ' + settings.birthWeightG + ' gr, ' + settings.birthHeightCm + ' cm';
    if (!settings.currentWeightG && !settings.currentHeightCm) {
      return birthText + '. Güncel boy/kilo girilmemiş.';
    }

    const parts = [];
    if (settings.currentWeightG) {
      parts.push(settings.currentWeightG + ' gr (' + formatWeightKgInput(settings.currentWeightG) + ' kg)');
    }
    if (settings.currentHeightCm) {
      parts.push(settings.currentHeightCm + ' cm');
    }

    let changeText = '';
    if (settings.currentWeightG) {
      const weightGain = settings.currentWeightG - settings.birthWeightG;
      changeText += ' Kilo değişimi: ' + (weightGain >= 0 ? '+' : '') + weightGain + ' gr.';
    }
    if (settings.currentHeightCm) {
      const heightGain = settings.currentHeightCm - settings.birthHeightCm;
      changeText += ' Boy değişimi: ' + (heightGain >= 0 ? '+' : '') + heightGain + ' cm.';
    }

    return birthText + '. Güncel: ' + parts.join(', ') + '.' + changeText;
  }

  function buildGrowthAdvice(settings, age) {
    if (!settings.currentWeightG && !settings.currentHeightCm) {
      return 'Güncel boy ve kilo girildiğinde büyüme de beslenme değerlendirmesine dahil edilir.';
    }

    let text = '';
    if (settings.currentWeightG) {
      const gain = settings.currentWeightG - settings.birthWeightG;
      text += 'Güncel kilo ' + formatWeightKgInput(settings.currentWeightG) + ' kg';
      text += ' (doğumdan bu yana ' + (gain >= 0 ? '+' : '') + gain + ' gr).';
    }
    if (settings.currentHeightCm) {
      const gainCm = settings.currentHeightCm - settings.birthHeightCm;
      text += ' Güncel boy ' + settings.currentHeightCm + ' cm';
      text += ' (doğumdan bu yana ' + (gainCm >= 0 ? '+' : '') + gainCm + ' cm).';
    }
    text += ' ' + age.weeks + ' haftalık bebek için büyüme ve beslenme birlikte izlenmeli.';
    return text.trim();
  }

  function saveSettingsData(settings) {
    if (window.FirestoreSync && window.FirestoreSync.isReady()) {
      window.FirestoreSync.saveSettings(settings).catch(function () {
        showToast('Ayarlar kaydedilemedi ☁️');
      });
      return true;
    }
    return false;
  }

  function openModal(modal) {
    if (!modal) return;
    modal.hidden = false;
    modal.removeAttribute('hidden');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('hidden', '');
  }

  function bindClick(el, handler) {
    if (el) el.addEventListener('click', handler);
  }

  function openSettingsModal() {
    const settings = loadSettings();
    if (els.babyNameInput) els.babyNameInput.value = settings.babyName || '';
    if (els.currentWeightInput) els.currentWeightInput.value = formatWeightKgInput(settings.currentWeightG);
    if (els.currentHeightInput) els.currentHeightInput.value = settings.currentHeightCm || '';
    openModal(els.settingsModal);
  }

  function formatEntryDetail(entry) {
    const time = formatTime(entry.timestamp);
    if (entry.type === 'kaka') {
      return entry.note ? time : `${time} · bez değişimi`;
    }
    if (entry.type === 'emdi') {
      const dur = entry.amount ? `${entry.amount} dk` : '';
      if (dur && entry.note) return `${dur} · ${time} · ${entry.note}`;
      if (dur) return `${dur} · ${time}`;
      return entry.note ? `${time} · ${entry.note}` : time;
    }
    if (entry.type === 'uyku') {
      const dur = entry.amount ? `${entry.amount} dk` : '';
      if (dur && entry.note) return `${dur} · ${time} · ${entry.note}`;
      if (dur) return `${dur} · ${time}`;
      return entry.note ? `${time} · ${entry.note}` : time;
    }
    const ml = `${entry.amount || '?'} ml · ${time}`;
    return entry.note ? `${ml} · ${entry.note}` : ml;
  }

  // --- Helpers ---

  const DAY_START_HOUR = 8;

  function getDateKeyFromTimestamp(isoStr) {
    const d = new Date(isoStr);
    const adjusted = new Date(d);
    if (adjusted.getHours() < DAY_START_HOUR) {
      adjusted.setDate(adjusted.getDate() - 1);
    }
    const y = adjusted.getFullYear();
    const m = String(adjusted.getMonth() + 1).padStart(2, '0');
    const day = String(adjusted.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function todayKey() {
    return getDateKeyFromTimestamp(new Date().toISOString());
  }

  function shiftDateKey(dateKey, deltaDays) {
    const d = new Date(dateKey + 'T12:00:00');
    d.setDate(d.getDate() + deltaDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('tr-TR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  function formatTime(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatShortDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const today = todayKey();
    const yesterdayKey = shiftDateKey(today, -1);

    if (dateStr === today) return 'Bugün';
    if (dateStr === yesterdayKey) return 'Dün';
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  }

  function getEntriesForDate(entries, dateKey) {
    return entries.filter(e => getDateKeyFromTimestamp(e.timestamp) === dateKey);
  }

  function parseEmdiMinutesFromNote(note) {
    if (!note || !/emdi/i.test(note)) return 0;
    let total = 0;
    const saatMatch = note.match(/(\d+)\s*saat/i);
    if (saatMatch) total += parseInt(saatMatch[1], 10) * 60;
    const rangeMatch = note.match(/(\d+)\s*-\s*(\d+)\s*dk/i);
    if (rangeMatch) {
      return total + Math.round((parseInt(rangeMatch[1], 10) + parseInt(rangeMatch[2], 10)) / 2);
    }
    const dkMatch = note.match(/(\d+)\s*dk/i);
    if (dkMatch) total += parseInt(dkMatch[1], 10);
    return total;
  }

  function getEmdiMinutes(entry) {
    if (!entry) return 0;
    if (entry.type === 'emdi') {
      if (entry.amount) return entry.amount;
      return parseEmdiMinutesFromNote(entry.note);
    }
    if (entry.type === 'sut' || entry.type === 'mama') {
      return parseEmdiMinutesFromNote(entry.note);
    }
    return 0;
  }

  function isEmdiSession(entry) {
    if (!entry) return false;
    if (entry.type === 'emdi') return true;
    if ((entry.type === 'sut' || entry.type === 'mama') && entry.note && /emdi/i.test(entry.note)) return true;
    return false;
  }

  function calcStats(entries) {
    let sut = 0, mama = 0, kaka = 0, emdi = 0, emdiCount = 0, uyku = 0, uykuCount = 0;
    entries.forEach(e => {
      if (e.type === 'sut') sut += e.amount || 0;
      else if (e.type === 'mama') mama += e.amount || 0;
      else if (e.type === 'kaka') kaka++;
      else if (e.type === 'uyku') {
        uyku += e.amount || 0;
        uykuCount++;
      }
      emdi += getEmdiMinutes(e);
      if (isEmdiSession(e)) emdiCount++;
    });
    return {
      sut, mama, total: sut + mama, kaka, emdi, emdiCount, uyku, uykuCount,
      feedCount: entries.filter(e => e.type === 'sut' || e.type === 'mama' || e.type === 'emdi').length
    };
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => { els.toast.hidden = true; }, 2500);
  }

  function spawnConfetti() {
    const emojis = ['⭐', '💕', '✨', '🌟', '💖'];
    for (let i = 0; i < 5; i++) {
      const el = document.createElement('span');
      el.className = 'confetti';
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.left = (30 + Math.random() * 40) + '%';
      el.style.bottom = '30%';
      el.style.animationDelay = (i * 0.1) + 's';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1200);
    }
  }

  function randomEncouragement() {
    return ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
  }

  function getBabyAge(birthDate) {
    if (!birthDate) return null;
    const birth = new Date(birthDate + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const diffMs = today - birth;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days < 0) return null;
    const weeks = Math.floor(days / 7);
    const remainDays = days % 7;
    return { days, weeks, remainDays };
  }

  function formatBabyAge(age) {
    if (!age) return '';
    if (age.days === 0) return '0 günlük 👶';
    if (age.weeks === 0) return `${age.days} günlük 👶`;
    if (age.remainDays === 0) return `${age.weeks} haftalık 👶`;
    return `${age.weeks} hafta ${age.remainDays} günlük 👶`;
  }

  function getRecentDayStats(daysBack) {
    const data = loadData();
    const result = [];
    for (let i = 1; i <= daysBack; i++) {
      const d = new Date(todayKey() + 'T12:00:00');
      d.setDate(d.getDate() - i);
      const key = getDateKeyFromTimestamp(d.toISOString());
      const entries = getEntriesForDate(data.entries, key);
      const stats = calcStats(entries);
      result.push({ date: key, ...stats, feedCount: stats.feedCount });
    }
    return result;
  }

  function getHistoricalOverview(daysBack) {
    const data = loadData();
    const days = [];
    for (let i = daysBack - 1; i >= 0; i--) {
      const key = shiftDateKey(todayKey(), -i);
      const entries = getEntriesForDate(data.entries, key);
      const stats = calcStats(entries);
      days.push({
        dateKey: key,
        label: formatShortDate(key),
        sut: stats.sut,
        mama: stats.mama,
        total: stats.total,
        kaka: stats.kaka,
        emdi: stats.emdi,
        emdiCount: stats.emdiCount,
        uyku: stats.uyku,
        uykuCount: stats.uykuCount,
        feedCount: stats.feedCount,
        hasData: entries.length > 0
      });
    }

    const recordedDays = days.filter(function (d) { return d.hasData; });
    const count = recordedDays.length;
    const sum = function (key) {
      return recordedDays.reduce(function (s, d) { return s + (d[key] || 0); }, 0);
    };
    const avg = function (key) {
      return count ? Math.round(sum(key) / count) : 0;
    };

    const recent3 = recordedDays.slice(-3);
    const prev3 = recordedDays.slice(-6, -3);
    const periodAvg = function (days, key) {
      return days.length
        ? Math.round(days.reduce(function (s, d) { return s + (d[key] || 0); }, 0) / days.length)
        : 0;
    };
    const avgRecent3 = periodAvg(recent3, 'total');
    const avgPrev3 = periodAvg(prev3, 'total');
    const avgRecent3Emdi = periodAvg(recent3, 'emdi');
    const avgPrev3Emdi = periodAvg(prev3, 'emdi');

    function getTrendDirection(recentAvg, prevAvg, shortDays, key) {
      if (prevAvg > 0 && recentAvg > 0) {
        if (recentAvg > prevAvg * 1.1) return 'up';
        if (recentAvg < prevAvg * 0.9) return 'down';
        return 'stable';
      }
      if (shortDays.length >= 2) {
        const first = shortDays[0][key] || 0;
        const last = shortDays[shortDays.length - 1][key] || 0;
        if (last > first * 1.15) return 'up';
        if (last < first * 0.85) return 'down';
      }
      return 'stable';
    }

    const mlTrendDir = getTrendDirection(avgRecent3, avgPrev3, recent3, 'total');
    const emdiTrendDir = getTrendDirection(avgRecent3Emdi, avgPrev3Emdi, recent3, 'emdi');

    let mlTrend = 'Süt/mama (ml) için yeterli geçmiş kayıt yok.';
    if (mlTrendDir === 'up') mlTrend = 'Süt/mama (ml) artış eğiliminde.';
    else if (mlTrendDir === 'down') mlTrend = 'Süt/mama (ml) azalış eğiliminde.';
    else if (recent3.length) mlTrend = 'Süt/mama (ml) genel olarak stabil.';

    let emdiTrend = 'Emzirme için yeterli geçmiş kayıt yok.';
    if (emdiTrendDir === 'up') emdiTrend = 'Emzirme süresi (dk) artış eğiliminde.';
    else if (emdiTrendDir === 'down') emdiTrend = 'Emzirme süresi (dk) azalış eğiliminde.';
    else if (recent3.length) emdiTrend = 'Emzirme süresi (dk) genel olarak stabil.';

    let trend;
    if (mlTrendDir === 'down' && emdiTrendDir === 'up') {
      trend = 'Süt/mama (ml) azalırken emzirme süresi artıyor — beslenme büyük ölçüde emzirmeye kaymış olabilir, bu tek başına olumsuz değerlendirilmemeli.';
    } else if (mlTrendDir === 'up' && emdiTrendDir === 'down') {
      trend = 'Süt/mama (ml) artarken emzirme süresi azalıyor — takviye mama oranı artmış olabilir.';
    } else if (mlTrendDir === 'down' && emdiTrendDir === 'down') {
      trend = 'Hem süt/mama (ml) hem emzirme süresi azalış eğiliminde — genel beslenmeyi birlikte izleyin.';
    } else if (mlTrendDir === 'up' && emdiTrendDir === 'up') {
      trend = 'Hem süt/mama (ml) hem emzirme süresi artış eğiliminde.';
    } else {
      trend = mlTrend + ' ' + emdiTrend;
    }

    return {
      days: days,
      recordedDays: count,
      avgTotal: avg('total'),
      avgSut: avg('sut'),
      avgMama: avg('mama'),
      avgEmdi: avg('emdi'),
      avgEmdiCount: avg('emdiCount'),
      avgUyku: avg('uyku'),
      avgUykuCount: avg('uykuCount'),
      avgKaka: avg('kaka'),
      avgFeedCount: avg('feedCount'),
      trend: trend,
      mlTrend: mlTrend,
      emdiTrend: emdiTrend,
      avgRecent3: avgRecent3,
      avgPrev3: avgPrev3,
      avgRecent3Emdi: avgRecent3Emdi,
      avgPrev3Emdi: avgPrev3Emdi
    };
  }

  function getTodaySummaryText() {
    const data = loadData();
    const entries = getEntriesForDate(data.entries, todayKey())
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return entries.map(e => {
      const time = formatTime(e.timestamp);
      if (e.type === 'kaka') return `${time} bez${e.note ? ' (' + e.note + ')' : ''}`;
      if (e.type === 'emdi') return `${time} ${e.amount || '?'}dk emzirme${e.note ? ' (' + e.note + ')' : ''}`;
      if (e.type === 'uyku') return `${time} ${e.amount || '?'}dk uyku${e.note ? ' (' + e.note + ')' : ''}`;
      if (e.type === 'sut') return `${time} ${e.amount}ml süt${e.note ? ' (' + e.note + ')' : ''}`;
      if (e.type === 'mama') return `${time} ${e.amount}ml mama${e.note ? ' (' + e.note + ')' : ''}`;
      return time;
    }).join('\n');
  }

  function getAiCacheKey() {
    const hour = new Date().getHours();
    const data = loadData();
    const todayEntries = getEntriesForDate(data.entries, todayKey());
    const stats = calcStats(todayEntries);
    const history = getHistoricalOverview(7);
    return AI_CACHE_PREFIX + todayKey() + '_h' + hour + '_' + stats.total + '_' + stats.kaka + '_' + todayEntries.length + '_a' + history.avgTotal + '_e' + history.avgEmdi + '_w' + (loadSettings().currentWeightG || 0) + '_hcm' + (loadSettings().currentHeightCm || 0) + '_d' + history.recordedDays;
  }

  function loadCachedAdvice() {
    try {
      const key = getAiCacheKey();
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveCachedAdvice(text) {
    localStorage.setItem(getAiCacheKey(), JSON.stringify({ text, at: Date.now() }));
  }

  function clearAiCache() {
    Object.keys(localStorage).filter(k => k.startsWith(AI_CACHE_PREFIX)).forEach(k => {
      localStorage.removeItem(k);
    });
  }

  function buildAiPrompt(settings, age) {
    const data = loadData();
    const todayEntries = getEntriesForDate(data.entries, todayKey());
    const stats = calcStats(todayEntries);
    const history = getHistoricalOverview(7);
    const name = settings.babyName.trim() || 'Bebek';
    const dayLines = history.days.map(function (d) {
      if (!d.hasData) return d.label + ': kayıt yok';
      return d.label + ': toplam ' + d.total + 'ml (süt ' + d.sut + ', mama ' + d.mama + '), ' + d.feedCount + ' beslenme, ' + d.emdi + 'dk emzirme, ' + (d.uyku || 0) + 'dk uyku, ' + d.kaka + ' bez';
    }).join('\n');

    return name + ', ' + age.days + ' günlük bebek (' + age.weeks + ' hafta ' + age.remainDays + ' gün).\n\n' +
      'BOY/KİLO: ' + formatGrowthContext(settings) + '\n\n' +
      'BUGÜN: süt ' + stats.sut + 'ml, mama ' + stats.mama + 'ml, toplam ' + stats.total + 'ml, ' + stats.feedCount + ' beslenme, ' + stats.emdi + 'dk emzirme (' + stats.emdiCount + ' kez), ' + stats.uyku + 'dk uyku (' + stats.uykuCount + ' kez), ' + stats.kaka + ' bez.\n\n' +
      'SON 7 GÜN:\n' + dayLines + '\n\n' +
      'GENEL ORTALAMALAR (' + history.recordedDays + ' kayıtlı gün): günlük ort. ' + history.avgTotal + 'ml (süt ' + history.avgSut + ', mama ' + history.avgMama + '), ort. ' + history.avgFeedCount + ' beslenme, ort. ' + history.avgEmdi + 'dk emzirme (' + history.avgEmdiCount + ' kez), ort. ' + history.avgUyku + 'dk uyku (' + history.avgUykuCount + ' kez), ort. ' + history.avgKaka + ' bez.\n' +
      'ML TREND: ' + history.mlTrend + ' (son 3 gün ort. ' + history.avgRecent3 + 'ml, önceki 3 gün ort. ' + history.avgPrev3 + 'ml)\n' +
      'EMZİRME TREND: ' + history.emdiTrend + ' (son 3 gün ort. ' + history.avgRecent3Emdi + 'dk, önceki 3 gün ort. ' + history.avgPrev3Emdi + 'dk)\n' +
      'BİRLEŞİK YORUM: ' + history.trend + '\n\n' +
      'ÖNEMLİ: Değerlendirmeyi yalnızca süt/mama ml miktarına göre yapma. Emzirme dakikaları da beslenmenin ayrılmaz parçasıdır. ml azalıp emzirme artıyorsa bunu "beslenme azalıyor" diye tek başına söyleme; emzirme artışını mutlaka belirt ve ml+emzirme dengesini birlikte yorumla.\n' +
      'Boy/kilo gelişimini (doğum: 3235 gr / 50 cm ve güncel değerler) beslenme değerlendirmesinde mutlaka dikkate al.\n' +
      'Değerlendirmeyi son 7 günün geçmişi, ortalamalar ve genel eğilim üzerinden yap. Bugünü bu bağlamda yorumla.\n' +
      'Yanıtın TAMAMEN Türkçe olmalı. Çince, İngilizce veya başka dilde tek bir kelime/karakter bile kullanma.\n' +
      'Türkçe, sıcak, max 200 kelime. Başlıklar: 📊 Genel Değerlendirme, 📅 Bugün, 📏 Büyüme, 💡 Tavsiye, 💩 Bez, 🌈 Moral. Teşhis koyma, endişede doktora yönlendir.';
  }

  const FOREIGN_SCRIPT_RE = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff]/;

  function containsForeignScript(text) {
    return FOREIGN_SCRIPT_RE.test(text || '');
  }

  function sanitizeAiText(text) {
    if (!text) return '';
    return text
      .replace(FOREIGN_SCRIPT_RE, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function normalizeAiAdvice(text) {
    const cleaned = sanitizeAiText(text);
    if (!cleaned || cleaned.length < 40) return null;
    if (containsForeignScript(cleaned)) return null;
    return cleaned;
  }

  function getAiSystemPrompt(strictTurkish) {
    let prompt = 'Sen deneyimli bir yenidoğan beslenme danışmanısın. Yalnızca Türkçe yaz; Çince, İngilizce veya başka dil kullanma. Türkçe karakterler ve emoji kullanabilirsin. Sıcak ve anlaşılır ol. Teşhis koyma. Değerlendirmede süt/mama ml miktarı ile emzirme ve uyku dakikalarını birlikte ele al; ml azalıp emzirme artıyorsa bunu beslenme kaybı olarak yorumlama. Bebeğin doğum ve güncel boy/kilo gelişimini de beslenme yorumuna dahil et.';
    if (strictTurkish) {
      prompt += ' Bu yanıtta kesinlikle yabancı dil veya yabancı alfabe kullanma; her cümle tamamen Türkçe olmalı.';
    }
    return prompt;
  }

  function buildLocalAdvice(settings, age) {
    const data = loadData();
    const stats = calcStats(getEntriesForDate(data.entries, todayKey()));
    const history = getHistoricalOverview(7);
    const name = settings.babyName.trim() || 'Bebek';

    let minMl = 450;
    let maxMl = 750;
    let feedTarget = '6-10';
    if (age.weeks < 2) {
      minMl = 350;
      maxMl = 550;
      feedTarget = '8-12';
    } else if (age.weeks < 4) {
      minMl = 500;
      maxMl = 800;
      feedTarget = '7-10';
    } else if (age.weeks < 8) {
      minMl = 600;
      maxMl = 900;
      feedTarget = '6-9';
    }

    let generalText;
    if (history.recordedDays === 0) {
      generalText = 'Henüz yeterli geçmiş kayıt yok. Birkaç gün kayıt girdikçe genel değerlendirme oluşacak.';
    } else {
      let rangeText;
      if (history.avgTotal < minMl) {
        rangeText = 'Son ' + history.recordedDays + ' günde günlük ortalama ' + history.avgTotal + ' ml (süt/mama) — yaşı için beklenen aralığın (' + minMl + '-' + maxMl + ' ml) altında.';
        if (history.avgEmdi >= 20) {
          rangeText += ' Ancak ortalama ' + history.avgEmdi + ' dk/gün emzirme kayıtlı; ml düşük görünse de beslenmenin önemli kısmı emzirmeden geliyor olabilir.';
        }
      } else if (history.avgTotal > maxMl) {
        rangeText = 'Son ' + history.recordedDays + ' günde günlük ortalama ' + history.avgTotal + ' ml — üst sınıra yakın veya üzerinde.';
      } else {
        rangeText = 'Son ' + history.recordedDays + ' günde günlük ortalama ' + history.avgTotal + ' ml — ' + age.weeks + ' haftalık bebek için genel olarak uygun aralıkta (' + minMl + '-' + maxMl + ' ml).';
      }

      let feedGeneral;
      if (history.avgFeedCount < 5) {
        feedGeneral = 'Ortalama ' + history.avgFeedCount + ' beslenme/gün; bu yaşta genelde ' + feedTarget + ' beslenme hedeflenir.';
      } else {
        feedGeneral = 'Ortalama ' + history.avgFeedCount + ' beslenme/gün ile sıklık genel olarak normal görünüyor (hedef: ' + feedTarget + '/gün).';
      }

      const mixGeneral = history.avgTotal
        ? ' Ortalama ' + history.avgSut + ' ml süt ve ' + history.avgMama + ' ml mama.'
        : '';
      const emdiGeneral = history.avgEmdi
        ? ' Ortalama günlük emzirme: ' + history.avgEmdi + ' dk (' + history.avgEmdiCount + ' kez).'
        : '';
      const uykuGeneral = history.avgUyku
        ? ' Ortalama günlük uyku: ' + history.avgUyku + ' dk (' + history.avgUykuCount + ' kez).'
        : '';

      generalText = rangeText + mixGeneral + ' ' + feedGeneral + emdiGeneral + uykuGeneral + ' ' + history.trend;
    }

    let todayText;
    if (stats.total === 0) {
      todayText = 'Bugün henüz beslenme kaydı yok.';
    } else if (history.avgTotal) {
      const diffPct = Math.round(((stats.total - history.avgTotal) / history.avgTotal) * 100);
      const diffLabel = diffPct > 10 ? 'ortalamanın üzerinde (+' + diffPct + '%)' :
        diffPct < -10 ? 'ortalamanın altında (' + diffPct + '%)' :
        '7 günlük ortalamaya (' + history.avgTotal + ' ml) yakın';
      todayText = 'Bugün toplam ' + stats.total + ' ml — genel ortalamaya göre ' + diffLabel + '. ' + stats.feedCount + ' beslenme, ' + stats.emdi + ' dk emzirme, ' + stats.uyku + ' dk uyku.';
    } else if (stats.total < minMl) {
      todayText = 'Bugün toplam ' + stats.total + ' ml — yaşı için beklenen aralığın (' + minMl + '-' + maxMl + ' ml) altında.';
    } else if (stats.total > maxMl) {
      todayText = 'Bugün toplam ' + stats.total + ' ml — üst sınıra yakın veya üzerinde.';
    } else {
      todayText = 'Bugün toplam ' + stats.total + ' ml — yaşı için uygun aralıkta.';
    }

    let bezText;
    const bezRef = history.avgKaka || stats.kaka;
    if (bezRef === 0) {
      bezText = 'Henüz bez kaydı yok. Günde 4-6 ıslak bez genelde iyidir.';
    } else if (history.avgKaka && history.avgKaka < 4) {
      bezText = 'Genel ortalama ' + history.avgKaka + ' bez/gün — takibe devam edin. Bugün ' + stats.kaka + ' bez.';
    } else {
      bezText = 'Genel ortalama ' + (history.avgKaka || stats.kaka) + ' bez/gün — bu yaş için normal aralıkta. Bugün ' + stats.kaka + ' bez.';
    }

    const recentDaysText = history.days
      .filter(function (d) { return d.hasData; })
      .map(function (d) { return d.label + ' ' + d.total + 'ml + ' + d.emdi + 'dk emzirme + ' + (d.uyku || 0) + 'dk uyku'; })
      .join(', ');

    const growthText = buildGrowthAdvice(settings, age);

    return '📊 GENEL DEĞERLENDİRME (Son 7 gün)\n' + generalText +
      (recentDaysText ? '\nGünlük toplamlar: ' + recentDaysText + '.' : '') +
      '\n\n📏 BÜYÜME\n' + growthText +
      '\n\n📅 BUGÜN\n' + todayText +
      '\n\n💡 TAVSİYE\n' + name + ' şu an ' + age.weeks + ' hafta ' + age.remainDays + ' günlük. ' +
      'Beslenmeler arası 2-3 saat genelde uygundur. Geçmiş kayıtlara göre düzenli takip yapıyorsunuz; emzirme ve mama dengesini bu genel eğilime göre gözlemleyin.\n\n' +
      '💩 BEZ/KAKA NOTU\n' + bezText +
      '\n\n🌈 MORAL\n' + name + ' için harika bir ebeveynsiniz, böyle devam! 💕';
  }

  function loadLastSuccessAdvice() {
    try {
      const raw = localStorage.getItem(AI_LAST_SUCCESS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveLastSuccessAdvice(text) {
    localStorage.setItem(AI_LAST_SUCCESS_KEY, JSON.stringify({ text: text, at: Date.now() }));
  }

  async function callGroqApi(apiKey, prompt, strictTurkish) {
    let lastError = null;
    for (let i = 0; i < GROQ_MODELS.length; i++) {
      const model = GROQ_MODELS[i];
      try {
        const res = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'system',
                content: getAiSystemPrompt(!!strictTurkish)
              },
              { role: 'user', content: prompt }
            ],
            temperature: strictTurkish ? 0.4 : 0.55,
            max_tokens: 512
          })
        });
        if (!res.ok) {
          const err = await res.json().catch(function () { return {}; });
          lastError = new Error(err.error?.message || 'Groq hatası (' + res.status + ')');
          continue;
        }
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          const cleaned = normalizeAiAdvice(text);
          if (cleaned) return cleaned;
          lastError = new Error('Yanıt Türkçe değil');
          continue;
        }
        lastError = new Error('Yanıt alınamadı');
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('Groq modelleri başarısız');
  }

  function requestAiAdvice(settings, age) {
    const prompt = buildAiPrompt(settings, age);
    return callGroqApi(settings.groqApiKey, prompt, false).catch(function () {
      const strictPrompt = prompt + '\n\nSON UYARI: Yanıt tamamen Türkçe olmalı. Çince, İngilizce veya başka dilde tek kelime bile yazma.';
      return callGroqApi(settings.groqApiKey, strictPrompt, true);
    });
  }

  function trySilentAiAdvice(forceRefresh) {
    const settings = loadSettings();
    const age = getBabyAge(settings.birthDate);
    if (!settings.groqApiKey || !age) return;

    const now = Date.now();
    if (!forceRefresh) {
      const cached = loadCachedAdvice();
      if (cached && cached.text) {
        const cleanCached = normalizeAiAdvice(cached.text);
        if (cleanCached) {
          showAiAdvice(cleanCached, 'ai');
          return;
        }
      }
    }
    if (lastApiCallAt && now - lastApiCallAt < AI_MIN_GAP_MS) return;
    if (aiLoading) return;

    aiLoading = true;
    setAdviceSource('loading');
    requestAiAdvice(settings, age).then(function (text) {
      lastApiCallAt = Date.now();
      saveCachedAdvice(text);
      saveLastSuccessAdvice(text);
      showAiAdvice(text, 'ai');
    }).catch(function () {
      updateLocalAdvice();
    }).finally(function () {
      aiLoading = false;
    });
  }

  function setAdviceSource(source) {
    if (!els.aiSourceBadge) return;
    currentAdviceSource = source;
    els.aiSourceBadge.className = 'ai-source-badge';
    if (source === 'ai') {
      els.aiSourceBadge.classList.add('ai-source-ai');
      els.aiSourceBadge.textContent = '🤖 Groq AI';
    } else if (source === 'loading') {
      els.aiSourceBadge.classList.add('ai-source-loading');
      els.aiSourceBadge.textContent = '⏳ AI güncelleniyor...';
    } else {
      els.aiSourceBadge.classList.add('ai-source-local');
      els.aiSourceBadge.textContent = '📱 Yerel tavsiye';
    }
  }

  function showAiAdvice(text, source) {
    const cleanText = source === 'ai' ? (normalizeAiAdvice(text) || text) : text;
    els.aiContent.textContent = cleanText;
    els.aiContent.hidden = false;
    els.aiPlaceholder.hidden = true;
    if (source) setAdviceSource(source);
  }

  function renderBabyAge() {
    const settings = loadSettings();
    const age = getBabyAge(settings.birthDate);
    els.babyAge.textContent = formatBabyAge(age);
  }

  function renderAiSection() {
    renderBabyAge();
    updateLocalAdvice();
    trySilentAiAdvice(true);
  }

  function updateLocalAdvice() {
    const settings = loadSettings();
    const age = getBabyAge(settings.birthDate);
    if (age) showAiAdvice(buildLocalAdvice(settings, age), 'local');
  }

  function scheduleAiRefresh() {
    clearTimeout(aiRefreshTimer);
    aiRefreshTimer = setTimeout(function () {
      trySilentAiAdvice(true);
    }, AI_DEBOUNCE_MS);
  }

  function startHourlyAdviceRefresh() {
    setInterval(function () {
      const hour = new Date().getHours();
      if (hour !== lastAdviceHour) {
        lastAdviceHour = hour;
        updateLocalAdvice();
        trySilentAiAdvice(true);
      }
    }, 60000);
  }

  // --- Render ---

  function renderHeader() {
    const settings = loadSettings();
    const name = settings.babyName.trim();
    els.babyName.textContent = name ? `${name} Takip 👶` : 'Bebiş Takip 👶';
    els.todayDate.textContent = formatDate(todayKey());
    els.encouragement.textContent = randomEncouragement();
  }

  function renderStats() {
    const data = loadData();
    const todayEntries = getEntriesForDate(data.entries, todayKey());
    const stats = calcStats(todayEntries);

    els.statSut.textContent = stats.sut;
    els.statMama.textContent = stats.mama;
    els.statTotal.textContent = stats.total;
    if (els.statEmdi) els.statEmdi.textContent = stats.emdi;
    if (els.statEmdiCount) els.statEmdiCount.textContent = stats.emdiCount + ' kez';
    if (els.statUyku) els.statUyku.textContent = stats.uyku;
    if (els.statUykuCount) els.statUykuCount.textContent = stats.uykuCount + ' kez';
    els.statKaka.textContent = stats.kaka;
  }

  let activeReportDateKey = null;

  function refreshEntryViews() {
    renderHeader();
    renderStats();
    renderTimeline();
    renderHistory();
    if (activeReportDateKey && !els.reportModal.hidden) {
      els.reportContent.textContent = generateReport(activeReportDateKey);
      renderReportEntries(activeReportDateKey);
    }
    if (currentAdviceSource !== 'ai') updateLocalAdvice();
    scheduleAiRefresh();
  }

  function findEntryById(id) {
    return loadData().entries.find(function (e) { return e.id === id; });
  }

  function buildEntryItemHTML(entry) {
    const cfg = TYPE_CONFIG[entry.type];
    const detail = formatEntryDetail(entry);
    let typeLabel = cfg.label;
    if (entry.type === 'kaka' && entry.note) typeLabel = `${cfg.label} · ${entry.note}`;
    else if (entry.type === 'emdi' && entry.amount) typeLabel = `${cfg.label} · ${entry.amount} dk`;
    else if (entry.type === 'uyku' && entry.amount) typeLabel = `${cfg.label} · ${entry.amount} dk`;

    return `
      <li class="timeline-item ${cfg.color}">
        <span class="timeline-emoji">${cfg.emoji}</span>
        <div class="timeline-info">
          <div class="timeline-type">${typeLabel}</div>
          <div class="timeline-detail">${detail}</div>
        </div>
        <div class="entry-actions">
          <button class="btn-edit" data-id="${entry.id}" aria-label="Düzenle">✏️</button>
          <button class="btn-delete" data-id="${entry.id}" aria-label="Sil">🗑️</button>
        </div>
      </li>
    `;
  }

  function bindEntryActionButtons(container) {
    if (!container) return;
    container.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => openEditEntry(btn.dataset.id));
    });
    container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteEntry(btn.dataset.id));
    });
  }

  function renderEntryList(container, entries, emptyMessage) {
    if (!container) return;
    if (entries.length === 0) {
      container.innerHTML = `<li class="empty-state">${emptyMessage}</li>`;
      return;
    }
    container.innerHTML = entries.map(buildEntryItemHTML).join('');
    bindEntryActionButtons(container);
  }

  function renderTimeline() {
    const data = loadData();
    const todayEntries = getEntriesForDate(data.entries, todayKey())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    renderEntryList(els.timelineList, todayEntries, 'Henüz kayıt yok. İlk kaydı ekleyin! 🌟');
  }

  function renderReportEntries(dateKey) {
    const data = loadData();
    const entries = getEntriesForDate(data.entries, dateKey)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    renderEntryList(els.reportEntryList, entries, 'Bu gün için kayıt yok.');
  }

  function renderHistory() {
    const data = loadData();
    const dateMap = {};

    data.entries.forEach(e => {
      const key = getDateKeyFromTimestamp(e.timestamp);
      if (!dateMap[key]) dateMap[key] = [];
      dateMap[key].push(e);
    });

    const dates = Object.keys(dateMap)
      .filter(d => d !== todayKey())
      .sort((a, b) => b.localeCompare(a));

    if (dates.length === 0) {
      els.historyList.innerHTML = '<p class="empty-state">Henüz geçmiş kayıt yok.</p>';
      return;
    }

    els.historyList.innerHTML = dates.map(dateKey => {
      const stats = calcStats(dateMap[dateKey]);
      return `
        <button class="history-item" data-date="${dateKey}">
          <div>
            <div class="history-date">${formatShortDate(dateKey)}</div>
            <div class="history-summary">
              🍼 ${stats.sut}ml · 🍶 ${stats.mama}ml · 🤱 ${stats.emdi}dk · ${stats.emdiCount} kez · 😴 ${stats.uyku}dk · ${stats.uykuCount} kez · 💩 ${stats.kaka}
            </div>
          </div>
          <span class="history-arrow">›</span>
        </button>
      `;
    }).join('');

    els.historyList.querySelectorAll('.history-item').forEach(btn => {
      btn.addEventListener('click', () => showReportForDate(btn.dataset.date));
    });
  }

  function renderAll() {
    renderHeader();
    renderStats();
    renderAiSection();
    renderTimeline();
    renderHistory();
  }

  // --- Actions ---

  function setCurrentTime() {
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    els.dateInput.value = `${y}-${mo}-${d}`;
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    els.timeInput.value = `${h}:${m}`;
  }

  function updateAmountVisibility() {
    const isKaka = selectedType === 'kaka';
    const isEmdi = selectedType === 'emdi';
    const isUyku = selectedType === 'uyku';
    const isFeed = selectedType === 'sut' || selectedType === 'mama';
    if (els.feedPanel) els.feedPanel.hidden = !isFeed;
    if (els.emdiPanel) els.emdiPanel.hidden = !isEmdi;
    if (els.uykuPanel) els.uykuPanel.hidden = !isUyku;
    if (els.bezPanel) els.bezPanel.hidden = !isKaka;
    if (isKaka) {
      els.amountInput.value = '';
      selectedPreset = null;
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
      if (els.emdiInput) els.emdiInput.value = '';
      selectedEmdiPreset = null;
      document.querySelectorAll('.emdi-preset-btn').forEach(b => b.classList.remove('selected'));
      if (els.uykuInput) els.uykuInput.value = '';
      selectedUykuPreset = null;
      document.querySelectorAll('.uyku-preset-btn').forEach(b => b.classList.remove('selected'));
      setTimeout(function () {
        if (els.noteInput) els.noteInput.focus();
      }, 50);
    } else if (isEmdi) {
      els.amountInput.value = '';
      selectedPreset = null;
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
      if (els.noteInput) els.noteInput.value = '';
      document.querySelectorAll('.note-preset-btn').forEach(b => b.classList.remove('selected'));
      if (els.uykuInput) els.uykuInput.value = '';
      selectedUykuPreset = null;
      document.querySelectorAll('.uyku-preset-btn').forEach(b => b.classList.remove('selected'));
      setTimeout(function () {
        if (els.emdiInput) els.emdiInput.focus();
      }, 50);
    } else if (isUyku) {
      els.amountInput.value = '';
      selectedPreset = null;
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
      if (els.noteInput) els.noteInput.value = '';
      document.querySelectorAll('.note-preset-btn').forEach(b => b.classList.remove('selected'));
      if (els.emdiInput) els.emdiInput.value = '';
      selectedEmdiPreset = null;
      document.querySelectorAll('.emdi-preset-btn').forEach(b => b.classList.remove('selected'));
      setTimeout(function () {
        if (els.uykuInput) els.uykuInput.focus();
      }, 50);
    } else {
      if (els.noteInput) els.noteInput.value = '';
      document.querySelectorAll('.note-preset-btn').forEach(b => b.classList.remove('selected'));
      if (els.emdiInput) els.emdiInput.value = '';
      selectedEmdiPreset = null;
      document.querySelectorAll('.emdi-preset-btn').forEach(b => b.classList.remove('selected'));
      if (els.uykuInput) els.uykuInput.value = '';
      selectedUykuPreset = null;
      document.querySelectorAll('.uyku-preset-btn').forEach(b => b.classList.remove('selected'));
    }
  }

  function getNoteValue() {
    return els.noteInput ? els.noteInput.value.trim() : '';
  }

  function addEntry() {
    if (!firestoreReady) {
      showToast('Veriler yükleniyor, bekleyin ☁️');
      return;
    }

    const dateVal = els.dateInput.value;
    if (!dateVal) {
      showToast('Lütfen tarih seçin 📅');
      return;
    }

    const timeVal = els.timeInput.value;
    if (!timeVal) {
      showToast('Lütfen saat girin ⏰');
      return;
    }

    let amount = null;
    if (selectedType === 'emdi') {
      amount = parseInt(els.emdiInput.value, 10);
      if (!amount || amount <= 0) {
        showToast('Lütfen süre girin (dk) 🤱');
        return;
      }
    } else if (selectedType === 'uyku') {
      amount = parseInt(els.uykuInput.value, 10);
      if (!amount || amount <= 0) {
        showToast('Lütfen süre girin (dk) 😴');
        return;
      }
    } else if (selectedType !== 'kaka') {
      amount = parseInt(els.amountInput.value, 10);
      if (!amount || amount <= 0) {
        showToast('Lütfen miktar girin (ml) 🍼');
        return;
      }
    }

    const [year, month, day] = dateVal.split('-').map(function (v) { return parseInt(v, 10); });
    const [h, m] = timeVal.split(':');
    const timestamp = new Date(year, month - 1, day, parseInt(h, 10), parseInt(m, 10)).toISOString();

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: selectedType,
      timestamp
    };

    if (selectedType === 'kaka') {
      const note = getNoteValue();
      if (note) entry.note = note;
    } else if (amount !== null) {
      entry.amount = amount;
    }

    const data = loadData();
    data.entries.push(entry);
    saveData(data);

    els.amountInput.value = '';
    if (els.emdiInput) els.emdiInput.value = '';
    if (els.uykuInput) els.uykuInput.value = '';
    if (els.noteInput) els.noteInput.value = '';
    selectedPreset = null;
    selectedEmdiPreset = null;
    selectedUykuPreset = null;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.emdi-preset-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.uyku-preset-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.note-preset-btn').forEach(b => b.classList.remove('selected'));
    setCurrentTime();

    spawnConfetti();
    const cfg = TYPE_CONFIG[selectedType];
    let noteMsg = '';
    if (selectedType === 'kaka' && entry.note) noteMsg = ' · ' + entry.note;
    else if (selectedType === 'emdi') noteMsg = ' · ' + amount + ' dk';
    else if (selectedType === 'uyku') noteMsg = ' · ' + amount + ' dk';
    showToast(`${cfg.emoji} ${cfg.label} kaydedildi${noteMsg}!`);
    renderHeader();
    renderStats();
    renderTimeline();
    renderHistory();
    updateLocalAdvice();
    scheduleAiRefresh();
    switchMainTab('bugun');
  }

  function deleteEntry(id) {
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    if (!firestoreReady || !window.FirestoreSync) {
      showToast('Veriler yükleniyor, bekleyin ☁️');
      return;
    }
    window.FirestoreSync.deleteEntry(id).catch(function () {
      showToast('Kayıt silinemedi ☁️');
      refreshEntryViews();
    });
    showToast('Kayıt silindi');
    refreshEntryViews();
  }

  function updateEditPanelsVisibility() {
    const isKaka = editSelectedType === 'kaka';
    const isEmdi = editSelectedType === 'emdi';
    const isUyku = editSelectedType === 'uyku';
    const isFeed = editSelectedType === 'sut' || editSelectedType === 'mama';
    if (els.editFeedPanel) els.editFeedPanel.hidden = !isFeed;
    if (els.editEmdiPanel) els.editEmdiPanel.hidden = !isEmdi;
    if (els.editUykuPanel) els.editUykuPanel.hidden = !isUyku;
    if (els.editBezPanel) els.editBezPanel.hidden = !isKaka;
  }

  function openEditEntry(id) {
    const entry = findEntryById(id);
    if (!entry) return;

    editingEntryId = id;
    editSelectedType = entry.type;

    document.querySelectorAll('.edit-type-tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.dataset.type === entry.type);
    });
    updateEditPanelsVisibility();

    const d = new Date(entry.timestamp);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    els.editDateInput.value = `${y}-${mo}-${day}`;
    els.editTimeInput.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    if (els.editAmountInput) els.editAmountInput.value = '';
    if (els.editEmdiInput) els.editEmdiInput.value = '';
    if (els.editUykuInput) els.editUykuInput.value = '';
    if (els.editNoteInput) els.editNoteInput.value = '';

    if (entry.type === 'kaka') {
      if (els.editNoteInput) els.editNoteInput.value = entry.note || '';
    } else if (entry.type === 'emdi') {
      if (els.editEmdiInput) els.editEmdiInput.value = entry.amount || '';
    } else if (entry.type === 'uyku') {
      if (els.editUykuInput) els.editUykuInput.value = entry.amount || '';
    } else if (els.editAmountInput) {
      els.editAmountInput.value = entry.amount || '';
    }

    els.editModal.hidden = false;
  }

  function closeEditModal() {
    els.editModal.hidden = true;
    editingEntryId = null;
  }

  function saveEditEntry() {
    if (!editingEntryId) return;
    if (!firestoreReady) {
      showToast('Veriler yükleniyor, bekleyin ☁️');
      return;
    }

    const dateVal = els.editDateInput.value;
    if (!dateVal) {
      showToast('Lütfen tarih seçin 📅');
      return;
    }

    const timeVal = els.editTimeInput.value;
    if (!timeVal) {
      showToast('Lütfen saat girin ⏰');
      return;
    }

    let amount = null;
    if (editSelectedType === 'emdi') {
      amount = parseInt(els.editEmdiInput.value, 10);
      if (!amount || amount <= 0) {
        showToast('Lütfen süre girin (dk) 🤱');
        return;
      }
    } else if (editSelectedType === 'uyku') {
      amount = parseInt(els.editUykuInput.value, 10);
      if (!amount || amount <= 0) {
        showToast('Lütfen süre girin (dk) 😴');
        return;
      }
    } else if (editSelectedType !== 'kaka') {
      amount = parseInt(els.editAmountInput.value, 10);
      if (!amount || amount <= 0) {
        showToast('Lütfen miktar girin (ml) 🍼');
        return;
      }
    }

    const [year, month, day] = dateVal.split('-').map(function (v) { return parseInt(v, 10); });
    const [h, m] = timeVal.split(':');
    const timestamp = new Date(year, month - 1, day, parseInt(h, 10), parseInt(m, 10)).toISOString();

    const existing = findEntryById(editingEntryId);
    if (!existing) {
      showToast('Kayıt bulunamadı');
      closeEditModal();
      return;
    }

    const entry = {
      id: editingEntryId,
      type: editSelectedType,
      timestamp
    };

    if (editSelectedType === 'kaka') {
      const note = els.editNoteInput ? els.editNoteInput.value.trim() : '';
      if (note) entry.note = note;
    } else if (amount !== null) {
      entry.amount = amount;
      if (existing && existing.note) entry.note = existing.note;
    }

    if (!window.FirestoreSync || !window.FirestoreSync.updateEntry) {
      showToast('Kayıt kaydedilemedi ☁️');
      return;
    }

    window.FirestoreSync.updateEntry(entry).then(function () {
      const cfg = TYPE_CONFIG[editSelectedType];
      showToast(`${cfg.emoji} Kayıt güncellendi!`);
      closeEditModal();
      refreshEntryViews();
    }).catch(function () {
      showToast('Kayıt kaydedilemedi ☁️');
    });
  }

  function generateReport(dateKey) {
    const data = loadData();
    const entries = getEntriesForDate(data.entries, dateKey)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const stats = calcStats(entries);
    const settings = loadSettings();
    const name = settings.babyName.trim() || 'Bebiş';

    let report = `🍼 ${name} - Günlük Rapor\n`;
    report += `${'='.repeat(30)}\n`;
    report += `📅 ${formatDate(dateKey)}\n\n`;

    report += `📊 ÖZET\n`;
    report += `  🍼 Süt:    ${stats.sut} ml\n`;
    report += `  🍶 Mama:   ${stats.mama} ml\n`;
    report += `  💧 Toplam: ${stats.total} ml\n`;
    report += `  🤱 Emzirme: ${stats.emdi} dk · ${stats.emdiCount} kez\n`;
    report += `  😴 Uyku: ${stats.uyku} dk · ${stats.uykuCount} kez\n`;
    report += `  🍽️ Beslenme: ${stats.feedCount} kez\n`;
    report += `  💩 Kaka:   ${stats.kaka} kez\n\n`;

    if (entries.length > 0) {
      report += `📋 DETAY\n`;
      entries.forEach(e => {
        const cfg = TYPE_CONFIG[e.type];
        const time = formatTime(e.timestamp);
        if (e.type === 'kaka') {
          report += `  ${time}  ${cfg.emoji} ${e.note || 'Bez'}\n`;
        } else if (e.type === 'emdi') {
          const dur = e.amount ? `${e.amount} dk` : '';
          const note = e.note ? ` (${e.note})` : '';
          report += `  ${time}  ${cfg.emoji} Emzirme${dur ? ' - ' + dur : ''}${note}\n`;
        } else if (e.type === 'uyku') {
          const dur = e.amount ? `${e.amount} dk` : '';
          const note = e.note ? ` (${e.note})` : '';
          report += `  ${time}  ${cfg.emoji} Uyku${dur ? ' - ' + dur : ''}${note}\n`;
        } else {
          const note = e.note ? ` (${e.note})` : '';
          report += `  ${time}  ${cfg.emoji} ${cfg.label} - ${e.amount} ml${note}\n`;
        }
      });
    } else {
      report += `Bu gün için kayıt bulunmuyor.\n`;
    }

    report += `\n${'='.repeat(30)}\n`;
    report += `Bebiş Takip 👶`;

    return report;
  }

  function formatChartDate(dateKey) {
    if (dateKey === todayKey()) return 'Bugün';
    const d = new Date(dateKey + 'T12:00:00');
    return d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric' });
  }

  function getLast7DaysStats() {
    const data = loadData();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const key = shiftDateKey(todayKey(), -i);
      const entries = getEntriesForDate(data.entries, key);
      const stats = calcStats(entries);
      days.push({
        dateKey: key,
        sut: stats.sut,
        mama: stats.mama,
        total: stats.total,
        kaka: stats.kaka,
        emdi: stats.emdi,
        uyku: stats.uyku
      });
    }
    return days;
  }

  function drawWeeklyChart(canvas, days) {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 320;
    const h = 220;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = { top: 28, right: 34, bottom: 40, left: 44 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const maxVal = Math.max(100, ...days.map(function (d) { return d.total; }));
    const niceMax = Math.ceil(maxVal / 100) * 100;
    const maxEmdi = Math.max(1, ...days.map(function (d) { return d.emdi || 0; }));
    const emdiAxisMax = Math.max(10, Math.ceil(maxEmdi / 10) * 10);

    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartH * (1 - i / 4);
      const val = Math.round(niceMax * i / 4);
      const emdiVal = Math.round(emdiAxisMax * i / 4);
      ctx.strokeStyle = '#ececec';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + chartW, y);
      ctx.stroke();
      ctx.fillStyle = '#888';
      ctx.font = '600 10px Nunito, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val + ' ml', pad.left - 5, y + 3);
      ctx.fillStyle = '#22c55e';
      ctx.textAlign = 'left';
      ctx.fillText(emdiVal + ' dk', pad.left + chartW + 5, y + 3);
    }

    const xAt = function (i) {
      return days.length > 1 ? pad.left + (i / (days.length - 1)) * chartW : pad.left + chartW / 2;
    };
    const yAt = function (val) {
      return pad.top + chartH * (1 - val / niceMax);
    };

    function drawLine(key, color, width, dashed) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dashed ? [7, 4] : []);
      ctx.beginPath();
      days.forEach(function (day, i) {
        const x = xAt(i);
        const y = yAt(day[key]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      days.forEach(function (day, i) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(xAt(i), yAt(day[key]), 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    drawLine('sut', '#5ba4d9', 2.5, false);
    drawLine('mama', '#7ec8e3', 2.5, false);
    drawLine('total', '#f59e0b', 3, true);

    // Emzirme süreleri (dk) - kesikli dikey çizgiler
    const yAtEmdi = function (val) {
      return pad.top + chartH * (1 - (val || 0) / emdiAxisMax);
    };
    ctx.strokeStyle = '#22c55e';
    ctx.fillStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.globalAlpha = 0.65;
    days.forEach(function (day, i) {
      if (!day.emdi) return;
      const x = xAt(i);
      const y = yAtEmdi(day.emdi);
      const yBase = pad.top + chartH;
      ctx.beginPath();
      ctx.moveTo(x, yBase);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    days.forEach(function (day, i) {
      ctx.fillStyle = '#555';
      ctx.font = '700 10px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(formatChartDate(day.dateKey), xAt(i), h - 12);
    });

    const legends = [
      { label: '🍼 Süt', color: '#5ba4d9' },
      { label: '🍶 Mama', color: '#7ec8e3' },
      { label: '💧 Toplam', color: '#f59e0b' },
      { label: '🤱 Emzirme', color: '#22c55e', dashed: true }
    ];
    let lx = pad.left;
    legends.forEach(function (leg) {
      ctx.strokeStyle = leg.color;
      ctx.lineWidth = 3;
      ctx.setLineDash(leg.dashed ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(lx, 12);
      ctx.lineTo(lx + 14, 12);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#333';
      ctx.font = '700 11px Nunito, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(leg.label, lx + 18, 15);
      lx += 18 + ctx.measureText(leg.label).width + 14;
    });
  }

  function generateWeeklyReportText(days) {
    const settings = loadSettings();
    const name = settings.babyName.trim() || 'Bebiş';
    let report = '📊 ' + name + ' - Haftalık Rapor (Son 7 Gün)\n';
    report += '='.repeat(30) + '\n\n';

    days.slice().reverse().forEach(function (d) {
      report += formatDate(d.dateKey) + '\n';
      report += '  🍼 Süt: ' + d.sut + ' ml  🍶 Mama: ' + d.mama + ' ml  💧 Toplam: ' + d.total + ' ml  🤱 Emzirme: ' + (d.emdi || 0) + ' dk  😴 Uyku: ' + (d.uyku || 0) + ' dk  💩 ' + d.kaka + ' bez\n\n';
    });

    const sumSut = days.reduce(function (s, d) { return s + d.sut; }, 0);
    const sumMama = days.reduce(function (s, d) { return s + d.mama; }, 0);
    const sumTotal = sumSut + sumMama;
    const sumEmdi = days.reduce(function (s, d) { return s + (d.emdi || 0); }, 0);
    const sumUyku = days.reduce(function (s, d) { return s + (d.uyku || 0); }, 0);
    report += '📈 HAFTA TOPLAMI\n';
    report += '  🍼 Süt: ' + sumSut + ' ml\n';
    report += '  🍶 Mama: ' + sumMama + ' ml\n';
    report += '  💧 Toplam: ' + sumTotal + ' ml\n';
    report += '  🤱 Emzirme: ' + sumEmdi + ' dk\n';
    report += '  😴 Uyku: ' + sumUyku + ' dk\n';
    report += '  📊 Günlük ortalama: ' + Math.round(sumTotal / 7) + ' ml\n';
    report += '\n' + '='.repeat(30) + '\nBebiş Takip 👶';
    return report;
  }

  function showWeeklyReport() {
    const days = getLast7DaysStats();
    els.weeklyReportContent.textContent = generateWeeklyReportText(days);
    els.weeklyReportModal.hidden = false;
    requestAnimationFrame(function () {
      drawWeeklyChart(els.weeklyChart, days);
    });
  }

  function showReportForDate(dateKey) {
    activeReportDateKey = dateKey;
    els.reportContent.textContent = generateReport(dateKey);
    renderReportEntries(dateKey);
    els.reportModal.hidden = false;
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(els.reportContent.textContent);
      showToast('Rapor kopyalandı! 📋');
    } catch {
      showToast('Kopyalama başarısız oldu');
    }
  }

  async function shareReport() {
    const text = els.reportContent.textContent;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Bebiş Günlük Rapor', text });
      } catch {
        /* kullanıcı iptal etti */
      }
    } else {
      copyReport();
    }
  }

  async function copyWeeklyReport() {
    try {
      await navigator.clipboard.writeText(els.weeklyReportContent.textContent);
      showToast('Haftalık rapor kopyalandı! 📋');
    } catch {
      showToast('Kopyalama başarısız oldu');
    }
  }

  async function shareWeeklyReport() {
    const text = els.weeklyReportContent.textContent;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Bebiş Haftalık Rapor', text });
      } catch {
        /* kullanıcı iptal etti */
      }
    } else {
      copyWeeklyReport();
    }
  }

  // --- Main Tabs ---

  function switchMainTab(tabId) {
    document.querySelectorAll('.main-tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(function (panel) {
      panel.hidden = panel.dataset.tabPanel !== tabId;
    });
  }

  // --- Event Listeners ---

  document.querySelectorAll('.main-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      switchMainTab(tab.dataset.tab);
    });
  });

  document.querySelectorAll('.type-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedType = tab.dataset.type;
      updateAmountVisibility();
    });
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPreset = parseInt(btn.dataset.ml, 10);
      els.amountInput.value = selectedPreset;
    });
  });

  els.amountInput.addEventListener('input', () => {
    selectedPreset = null;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
  });

  document.querySelectorAll('.emdi-preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.emdi-preset-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedEmdiPreset = parseInt(btn.dataset.dk, 10);
      if (els.emdiInput) els.emdiInput.value = selectedEmdiPreset;
    });
  });

  if (els.emdiInput) {
    els.emdiInput.addEventListener('input', () => {
      selectedEmdiPreset = null;
      document.querySelectorAll('.emdi-preset-btn').forEach(b => b.classList.remove('selected'));
    });
  }

  document.querySelectorAll('.uyku-preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.uyku-preset-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedUykuPreset = parseInt(btn.dataset.dk, 10);
      if (els.uykuInput) els.uykuInput.value = selectedUykuPreset;
    });
  });

  if (els.uykuInput) {
    els.uykuInput.addEventListener('input', () => {
      selectedUykuPreset = null;
      document.querySelectorAll('.uyku-preset-btn').forEach(b => b.classList.remove('selected'));
    });
  }

  document.querySelectorAll('.note-preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.note-preset-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (els.noteInput) {
        els.noteInput.value = btn.dataset.note;
        els.noteInput.focus();
      }
    });
  });

  if (els.noteInput) {
    els.noteInput.addEventListener('input', () => {
      document.querySelectorAll('.note-preset-btn').forEach(b => b.classList.remove('selected'));
    });
  }

  bindClick(els.addBtn, addEntry);
  bindClick(els.weeklyReportBtn, showWeeklyReport);

  document.querySelectorAll('.edit-type-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.edit-type-tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      editSelectedType = tab.dataset.type;
      updateEditPanelsVisibility();
    });
  });

  els.saveEdit.addEventListener('click', saveEditEntry);
  els.cancelEdit.addEventListener('click', closeEditModal);
  els.closeEdit.addEventListener('click', closeEditModal);
  els.editModal.addEventListener('click', function (e) {
    if (e.target === els.editModal) closeEditModal();
  });

  bindClick(els.closeWeeklyReport, function () { closeModal(els.weeklyReportModal); });
  if (els.weeklyReportModal) {
    els.weeklyReportModal.addEventListener('click', function (e) {
      if (e.target === els.weeklyReportModal) closeModal(els.weeklyReportModal);
    });
  }
  bindClick(els.copyWeeklyReport, copyWeeklyReport);
  bindClick(els.shareWeeklyReport, shareWeeklyReport);

  bindClick(els.settingsBtn, openSettingsModal);

  bindClick(els.closeSettings, function () { closeModal(els.settingsModal); });
  if (els.settingsModal) {
    els.settingsModal.addEventListener('click', function (e) {
      if (e.target === els.settingsModal) closeModal(els.settingsModal);
    });
  }

  bindClick(els.saveSettings, function () {
    const babyName = els.babyNameInput ? els.babyNameInput.value.trim() : '';
    const growth = readGrowthInputsFromForm();
    if (growth.error) {
      showToast(growth.error);
      return;
    }
    if (!saveSettingsData({
      babyName: babyName,
      currentWeightG: growth.currentWeightG,
      currentHeightCm: growth.currentHeightCm
    })) {
      showToast('Ayarlar kaydedilemedi ☁️');
      return;
    }
    closeModal(els.settingsModal);
    showToast('Ayarlar kaydedildi! ⚙️');
    renderHeader();
    renderBabyAge();
    updateLocalAdvice();
    trySilentAiAdvice(true);
  });

  els.closeReport.addEventListener('click', () => {
    els.reportModal.hidden = true;
    activeReportDateKey = null;
  });
  els.reportModal.addEventListener('click', e => {
    if (e.target === els.reportModal) {
      els.reportModal.hidden = true;
      activeReportDateKey = null;
    }
  });

  els.copyReport.addEventListener('click', copyReport);
  els.shareReport.addEventListener('click', shareReport);

  // --- Init ---

  function onRemoteSyncUpdate() {
    renderHeader();
    renderStats();
    renderTimeline();
    renderHistory();
    renderBabyAge();
    updateLocalAdvice();
    showToast('Veriler güncellendi ☁️');
  }

  async function initApp() {
    if (window.FirestoreSync) {
      const syncResult = await window.FirestoreSync.init(onRemoteSyncUpdate);
      firestoreReady = !!syncResult;
      if (!firestoreReady) {
        showToast('Firestore bağlantısı kurulamadı ☁️');
      } else if (syncResult.uploaded && syncResult.entryCount > 0) {
        showToast(syncResult.entryCount + ' kayıt Firestore\'a yüklendi ☁️');
      }
    } else {
      showToast('Firestore yüklenemedi ☁️');
    }

    setCurrentTime();
    updateAmountVisibility();
    renderAll();
    startHourlyAdviceRefresh();
  }

  initApp();
})();
