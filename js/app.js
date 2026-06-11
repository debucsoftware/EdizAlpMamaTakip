(function () {
  'use strict';

  const AI_CACHE_PREFIX = 'bebistakip_ai_';
  const DEFAULT_SETTINGS = {
    babyName: 'Ediz',
    birthDate: '2026-05-14',
    groqApiKey: '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'
  };
  const FIXED_BIRTH_DATE = DEFAULT_SETTINGS.birthDate;
  const FIXED_GROQ_KEY = DEFAULT_SETTINGS.groqApiKey;
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
    emdi: { emoji: '🤱', label: 'Emzirme', color: 'sut' }
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
  let aiLoading = false;
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
    statKaka: document.getElementById('statKaka'),
    encouragement: document.getElementById('encouragement'),
    feedPanel: document.getElementById('feedPanel'),
    bezPanel: document.getElementById('bezPanel'),
    noteInput: document.getElementById('noteInput'),
    amountInput: document.getElementById('amountInput'),
    timeInput: document.getElementById('timeInput'),
    addBtn: document.getElementById('addBtn'),
    timelineList: document.getElementById('timelineList'),
    historyList: document.getElementById('historyList'),
    reportBtn: document.getElementById('reportBtn'),
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
    saveSettings: document.getElementById('saveSettings'),
    reportModal: document.getElementById('reportModal'),
    closeReport: document.getElementById('closeReport'),
    reportContent: document.getElementById('reportContent'),
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

  function loadSettings() {
    const synced = (window.FirestoreSync && window.FirestoreSync.isReady())
      ? window.FirestoreSync.getSettings()
      : { babyName: DEFAULT_SETTINGS.babyName };
    return {
      babyName: synced.babyName || DEFAULT_SETTINGS.babyName,
      birthDate: FIXED_BIRTH_DATE,
      groqApiKey: FIXED_GROQ_KEY
    };
  }

  function saveSettingsData(settings) {
    if (!window.FirestoreSync || !window.FirestoreSync.isReady()) return;
    window.FirestoreSync.saveSettings(settings).catch(function () {
      showToast('Ayarlar kaydedilemedi ☁️');
    });
  }

  function formatEntryDetail(entry) {
    const time = formatTime(entry.timestamp);
    if (entry.type === 'kaka') {
      return entry.note ? time : `${time} · bez değişimi`;
    }
    if (entry.type === 'emdi') {
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

  function calcStats(entries) {
    let sut = 0, mama = 0, kaka = 0;
    entries.forEach(e => {
      if (e.type === 'sut') sut += e.amount || 0;
      else if (e.type === 'mama') mama += e.amount || 0;
      else if (e.type === 'kaka') kaka++;
    });
    return {
      sut, mama, total: sut + mama, kaka,
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

  function getTodaySummaryText() {
    const data = loadData();
    const entries = getEntriesForDate(data.entries, todayKey())
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return entries.map(e => {
      const time = formatTime(e.timestamp);
      if (e.type === 'kaka') return `${time} bez${e.note ? ' (' + e.note + ')' : ''}`;
      if (e.type === 'emdi') return `${time} emzirme${e.note ? ' (' + e.note + ')' : ''}`;
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
    return AI_CACHE_PREFIX + todayKey() + '_h' + hour + '_' + stats.total + '_' + stats.kaka + '_' + todayEntries.length;
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
    const recent = getRecentDayStats(3);
    const name = settings.babyName.trim() || 'Bebek';
    const recentText = recent.map(d => d.total + 'ml').join(', ') || 'yok';

    return name + ', ' + age.days + ' günlük bebek. Bugün: süt ' + stats.sut + 'ml, mama ' + stats.mama + 'ml, toplam ' + stats.total + 'ml, ' + stats.feedCount + ' beslenme, ' + stats.kaka + ' bez. Son 3 gün toplamları: ' + recentText + '.\nTürkçe, sıcak, max 150 kelime. Başlıklar: 📊 Değerlendirme, 💡 Tavsiye, 💩 Bez, 🌈 Moral. Teşhis koyma, endişede doktora yönlendir.';
  }

  function buildLocalAdvice(settings, age) {
    const data = loadData();
    const stats = calcStats(getEntriesForDate(data.entries, todayKey()));
    const name = settings.babyName.trim() || 'Bebek';
    const recent = getRecentDayStats(3);
    const avgTotal = recent.length
      ? Math.round(recent.reduce(function (s, d) { return s + d.total; }, 0) / recent.length)
      : 0;

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

    let evalText;
    if (stats.total === 0) {
      evalText = 'Henüz bugün beslenme kaydı yok. Kayıt girdikçe değerlendirme güncellenecek.';
    } else if (stats.total < minMl) {
      evalText = 'Bugün toplam ' + stats.total + ' ml — yaşı için beklenen aralığın (' + minMl + '-' + maxMl + ' ml) altında.';
    } else if (stats.total > maxMl) {
      evalText = 'Bugün toplam ' + stats.total + ' ml — üst sınıra yakın veya üzerinde. Bebeğin tok ve rahat olduğunu gözlemleyin.';
    } else {
      evalText = 'Bugün toplam ' + stats.total + ' ml — ' + age.weeks + ' haftalık bebek için uygun aralıkta (' + minMl + '-' + maxMl + ' ml).';
    }

    let feedText;
    if (stats.feedCount === 0) {
      feedText = 'Beslenme kaydı bekleniyor.';
    } else if (stats.feedCount < 5) {
      feedText = stats.feedCount + ' beslenme var. Bu yaşta genelde günde ' + feedTarget + ' beslenme hedeflenir.';
    } else {
      feedText = stats.feedCount + ' beslenme ile sıklık normal görünüyor (hedef: ' + feedTarget + '/gün).';
    }

    let bezText;
    if (stats.kaka === 0) {
      bezText = 'Henüz bez kaydı yok. Günde 4-6 ıslak bez genelde iyidir.';
    } else if (stats.kaka < 4) {
      bezText = stats.kaka + ' bez kaydı — takibe devam edin.';
    } else {
      bezText = stats.kaka + ' bez değişimi — bu yaş için normal aralıkta.';
    }

    const trend = avgTotal && stats.total
      ? (stats.total > avgTotal * 1.15 ? 'Son günlere göre bugün daha yüksek.' :
        stats.total < avgTotal * 0.85 ? 'Son günlere göre bugün daha düşük.' :
        'Son 3 gün ortalamasına (' + avgTotal + ' ml) yakın.')
      : '';

    const sutPct = stats.total ? Math.round((stats.sut / stats.total) * 100) : 0;
    let mixText = '';
    if (stats.total > 0) {
      mixText = ' Bugün ' + stats.sut + ' ml süt (%' + sutPct + ') ve ' + stats.mama + ' ml mama.';
    }

    return '📊 BUGÜNKÜ DEĞERLENDİRME\n' + evalText + mixText + ' ' + feedText + ' ' + trend +
      '\n\n💡 GÜNLÜK TAVSİYE\n' + name + ' şu an ' + age.weeks + ' hafta ' + age.remainDays + ' günlük. ' +
      'Beslenmeler arası 2-3 saat genelde uygundur. Emzirme sonrası takviye mama verirken bebeğin doyduğunu gözlemleyin. Kayıtları düzenli tutmanız harika!\n\n' +
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

  async function callGroqApi(apiKey, prompt) {
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
                content: 'Sen deneyimli bir yenidoğan beslenme danışmanısın. Türkçe, sıcak ve anlaşılır yaz. Teşhis koyma.'
              },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
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
        if (text) return text.trim();
        lastError = new Error('Yanıt alınamadı');
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('Groq modelleri başarısız');
  }

  function trySilentAiAdvice(forceRefresh) {
    const settings = loadSettings();
    const age = getBabyAge(settings.birthDate);
    if (!settings.groqApiKey || !age) return;

    const now = Date.now();
    if (!forceRefresh) {
      const cached = loadCachedAdvice();
      if (cached && cached.text) {
        showAiAdvice(cached.text, 'ai');
        return;
      }
    }
    if (lastApiCallAt && now - lastApiCallAt < AI_MIN_GAP_MS) return;
    if (aiLoading) return;

    aiLoading = true;
    setAdviceSource('loading');
    const prompt = buildAiPrompt(settings, age);
    callGroqApi(settings.groqApiKey, prompt).then(function (text) {
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
    els.aiContent.textContent = text;
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
    els.statKaka.textContent = stats.kaka;
  }

  function renderTimeline() {
    const data = loadData();
    const todayEntries = getEntriesForDate(data.entries, todayKey())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (todayEntries.length === 0) {
      els.timelineList.innerHTML = '<li class="empty-state">Henüz kayıt yok. İlk kaydı ekleyin! 🌟</li>';
      return;
    }

    els.timelineList.innerHTML = todayEntries.map(entry => {
      const cfg = TYPE_CONFIG[entry.type];
      const detail = formatEntryDetail(entry);
      const typeLabel = entry.type === 'kaka' && entry.note
        ? `${cfg.label} · ${entry.note}`
        : cfg.label;

      return `
        <li class="timeline-item ${cfg.color}">
          <span class="timeline-emoji">${cfg.emoji}</span>
          <div class="timeline-info">
            <div class="timeline-type">${typeLabel}</div>
            <div class="timeline-detail">${detail}</div>
          </div>
          <button class="btn-delete" data-id="${entry.id}" aria-label="Sil">🗑️</button>
        </li>
      `;
    }).join('');

    els.timelineList.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteEntry(btn.dataset.id));
    });
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
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 30);

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
              🍼 ${stats.sut}ml · 🍶 ${stats.mama}ml · 💩 ${stats.kaka}
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
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    els.timeInput.value = `${h}:${m}`;
  }

  function updateAmountVisibility() {
    const isKaka = selectedType === 'kaka';
    if (els.feedPanel) els.feedPanel.hidden = isKaka;
    if (els.bezPanel) els.bezPanel.hidden = !isKaka;
    if (isKaka) {
      els.amountInput.value = '';
      selectedPreset = null;
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
      setTimeout(function () {
        if (els.noteInput) els.noteInput.focus();
      }, 50);
    } else {
      if (els.noteInput) els.noteInput.value = '';
      document.querySelectorAll('.note-preset-btn').forEach(b => b.classList.remove('selected'));
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

    const timeVal = els.timeInput.value;
    if (!timeVal) {
      showToast('Lütfen saat girin ⏰');
      return;
    }

    let amount = null;
    if (selectedType !== 'kaka') {
      amount = parseInt(els.amountInput.value, 10);
      if (!amount || amount <= 0) {
        showToast('Lütfen miktar girin (ml) 🍼');
        return;
      }
    }

    const [h, m] = timeVal.split(':');
    const now = new Date();
    const timestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(h, 10), parseInt(m, 10)).toISOString();

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: selectedType,
      amount,
      timestamp
    };

    if (selectedType === 'kaka') {
      const note = getNoteValue();
      if (note) entry.note = note;
    }

    const data = loadData();
    data.entries.push(entry);
    saveData(data);

    els.amountInput.value = '';
    if (els.noteInput) els.noteInput.value = '';
    selectedPreset = null;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.note-preset-btn').forEach(b => b.classList.remove('selected'));
    setCurrentTime();

    spawnConfetti();
    const cfg = TYPE_CONFIG[selectedType];
    const noteMsg = selectedType === 'kaka' && entry.note ? ' · ' + entry.note : '';
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
      renderHeader();
      renderStats();
      renderTimeline();
      renderHistory();
    });
    showToast('Kayıt silindi');
    renderHeader();
    renderStats();
    renderTimeline();
    renderHistory();
    updateLocalAdvice();
    scheduleAiRefresh();
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
          report += `  ${time}  ${cfg.emoji} ${e.note || 'Emzirme'}\n`;
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
        kaka: stats.kaka
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

    const pad = { top: 28, right: 12, bottom: 40, left: 38 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const maxVal = Math.max(100, ...days.map(function (d) { return d.total; }));
    const niceMax = Math.ceil(maxVal / 100) * 100;

    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartH * (1 - i / 4);
      const val = Math.round(niceMax * i / 4);
      ctx.strokeStyle = '#ececec';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + chartW, y);
      ctx.stroke();
      ctx.fillStyle = '#888';
      ctx.font = '600 10px Nunito, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(val), pad.left - 5, y + 3);
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

    drawLine('sut', '#ff91a4', 2.5, false);
    drawLine('mama', '#7ec8e3', 2.5, false);
    drawLine('total', '#f59e0b', 3, true);

    days.forEach(function (day, i) {
      ctx.fillStyle = '#555';
      ctx.font = '700 10px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(formatChartDate(day.dateKey), xAt(i), h - 12);
    });

    const legends = [
      { label: '🍼 Süt', color: '#ff91a4' },
      { label: '🍶 Mama', color: '#7ec8e3' },
      { label: '💧 Toplam', color: '#f59e0b' }
    ];
    let lx = pad.left;
    legends.forEach(function (leg) {
      ctx.strokeStyle = leg.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lx, 12);
      ctx.lineTo(lx + 14, 12);
      ctx.stroke();
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

    days.forEach(function (d) {
      report += formatDate(d.dateKey) + '\n';
      report += '  🍼 Süt: ' + d.sut + ' ml  🍶 Mama: ' + d.mama + ' ml  💧 Toplam: ' + d.total + ' ml  💩 ' + d.kaka + ' bez\n\n';
    });

    const sumSut = days.reduce(function (s, d) { return s + d.sut; }, 0);
    const sumMama = days.reduce(function (s, d) { return s + d.mama; }, 0);
    const sumTotal = sumSut + sumMama;
    report += '📈 HAFTA TOPLAMI\n';
    report += '  🍼 Süt: ' + sumSut + ' ml\n';
    report += '  🍶 Mama: ' + sumMama + ' ml\n';
    report += '  💧 Toplam: ' + sumTotal + ' ml\n';
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
    els.reportContent.textContent = generateReport(dateKey);
    els.reportModal.hidden = false;
  }

  function showTodayReport() {
    showReportForDate(todayKey());
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

  els.addBtn.addEventListener('click', addEntry);
  els.reportBtn.addEventListener('click', showTodayReport);
  els.weeklyReportBtn.addEventListener('click', showWeeklyReport);

  els.closeWeeklyReport.addEventListener('click', () => { els.weeklyReportModal.hidden = true; });
  els.weeklyReportModal.addEventListener('click', e => {
    if (e.target === els.weeklyReportModal) els.weeklyReportModal.hidden = true;
  });
  els.copyWeeklyReport.addEventListener('click', copyWeeklyReport);
  els.shareWeeklyReport.addEventListener('click', shareWeeklyReport);

  els.settingsBtn.addEventListener('click', () => {
    const settings = loadSettings();
    els.babyNameInput.value = settings.babyName || '';
    els.settingsModal.hidden = false;
  });

  els.closeSettings.addEventListener('click', () => { els.settingsModal.hidden = true; });
  els.settingsModal.addEventListener('click', e => {
    if (e.target === els.settingsModal) els.settingsModal.hidden = true;
  });

  els.saveSettings.addEventListener('click', () => {
    saveSettingsData({ babyName: els.babyNameInput.value.trim() });
    els.settingsModal.hidden = true;
    showToast('Ayarlar kaydedildi! ⚙️');
    renderHeader();
    renderBabyAge();
    updateLocalAdvice();
    trySilentAiAdvice(true);
  });

  els.closeReport.addEventListener('click', () => { els.reportModal.hidden = true; });
  els.reportModal.addEventListener('click', e => {
    if (e.target === els.reportModal) els.reportModal.hidden = true;
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
