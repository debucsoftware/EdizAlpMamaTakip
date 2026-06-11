(function () {
  'use strict';

  const STORAGE_KEY = 'bebistakip_data';
  const SETTINGS_KEY = 'bebistakip_settings';
  const SEED_FLAG = 'bebistakip_seed_v1';

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

  // DOM
  const els = {
    babyName: document.getElementById('babyName'),
    todayDate: document.getElementById('todayDate'),
    statSut: document.getElementById('statSut'),
    statMama: document.getElementById('statMama'),
    statTotal: document.getElementById('statTotal'),
    statKaka: document.getElementById('statKaka'),
    encouragement: document.getElementById('encouragement'),
    amountSection: document.getElementById('amountSection'),
    noteSection: document.getElementById('noteSection'),
    noteInput: document.getElementById('noteInput'),
    amountInput: document.getElementById('amountInput'),
    timeInput: document.getElementById('timeInput'),
    addBtn: document.getElementById('addBtn'),
    timelineList: document.getElementById('timelineList'),
    historyList: document.getElementById('historyList'),
    reportBtn: document.getElementById('reportBtn'),
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
    toast: document.getElementById('toast')
  };

  // --- Storage ---

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { entries: [] };
    } catch {
      return { entries: [] };
    }
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : { babyName: '' };
    } catch {
      return { babyName: '' };
    }
  }

  function saveSettingsData(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function importSeedIfNeeded() {
    if (localStorage.getItem(SEED_FLAG)) return;
    if (!window.BEBIS_SEED) return;
    saveData({ entries: window.BEBIS_SEED.entries || [] });
    if (window.BEBIS_SEED.settings) {
      saveSettingsData(window.BEBIS_SEED.settings);
    }
    localStorage.setItem(SEED_FLAG, '1');
  }

  function formatEntryDetail(entry) {
    const time = formatTime(entry.timestamp);
    if (entry.type === 'kaka') {
      return entry.note ? `${time} · ${entry.note}` : time;
    }
    if (entry.type === 'emdi') {
      return entry.note ? `${time} · ${entry.note}` : time;
    }
    const ml = `${entry.amount || '?'} ml · ${time}`;
    return entry.note ? `${ml} · ${entry.note}` : ml;
  }

  // --- Helpers ---

  function getDateKeyFromTimestamp(isoStr) {
    const d = new Date(isoStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function todayKey() {
    return getDateKeyFromTimestamp(new Date().toISOString());
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
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);

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

      return `
        <li class="timeline-item ${cfg.color}">
          <span class="timeline-emoji">${cfg.emoji}</span>
          <div class="timeline-info">
            <div class="timeline-type">${cfg.label}</div>
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
    els.amountSection.hidden = isKaka;
    els.noteSection.hidden = !isKaka;
    if (isKaka) {
      els.amountInput.value = '';
      selectedPreset = null;
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
    } else {
      els.noteInput.value = '';
      document.querySelectorAll('.note-preset-btn').forEach(b => b.classList.remove('selected'));
    }
  }

  function addEntry() {
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
      const note = els.noteInput.value.trim();
      if (note) entry.note = note;
    }

    const data = loadData();
    data.entries.push(entry);
    saveData(data);

    els.amountInput.value = '';
    els.noteInput.value = '';
    selectedPreset = null;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.note-preset-btn').forEach(b => b.classList.remove('selected'));
    setCurrentTime();

    spawnConfetti();
    const cfg = TYPE_CONFIG[selectedType];
    showToast(`${cfg.emoji} ${cfg.label} kaydedildi!`);
    renderAll();
  }

  function deleteEntry(id) {
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    const data = loadData();
    data.entries = data.entries.filter(e => e.id !== id);
    saveData(data);
    showToast('Kayıt silindi');
    renderAll();
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

  // --- Event Listeners ---

  document.querySelectorAll('.type-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedType = tab.dataset.type;
      updateAmountVisibility();
    });
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
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
    btn.addEventListener('click', () => {
      document.querySelectorAll('.note-preset-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      els.noteInput.value = btn.dataset.note;
    });
  });

  els.noteInput.addEventListener('input', () => {
    document.querySelectorAll('.note-preset-btn').forEach(b => b.classList.remove('selected'));
  });

  els.addBtn.addEventListener('click', addEntry);
  els.reportBtn.addEventListener('click', showTodayReport);

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
  });

  els.closeReport.addEventListener('click', () => { els.reportModal.hidden = true; });
  els.reportModal.addEventListener('click', e => {
    if (e.target === els.reportModal) els.reportModal.hidden = true;
  });

  els.copyReport.addEventListener('click', copyReport);
  els.shareReport.addEventListener('click', shareReport);

  // --- Init ---

  importSeedIfNeeded();
  setCurrentTime();
  updateAmountVisibility();
  renderAll();
})();
