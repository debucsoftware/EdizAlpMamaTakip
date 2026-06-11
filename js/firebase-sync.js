(function () {
  'use strict';

  const STORAGE_KEY = 'bebistakip_data';
  const SETTINGS_KEY = 'bebistakip_settings';
  const SEED_FLAG = 'bebistakip_seed_v1';
  const DOC_COLLECTION = 'app';
  const DOC_ID = 'ediz';

  const firebaseConfig = {
    apiKey: 'AIzaSyBJi-kNnFrTIgQQxIz16Rvjga2zMJV4OJY',
    authDomain: 'edizalpmamatakip.firebaseapp.com',
    projectId: 'edizalpmamatakip',
    storageBucket: 'edizalpmamatakip.firebasestorage.app',
    messagingSenderId: '806010589769',
    appId: '1:806010589769:web:5939d0716125f94a1f6598',
    measurementId: 'G-RTXS3LBPSK'
  };

  let db = null;
  let unsubscribe = null;
  let ignoreNextSnapshot = false;
  let lastPushAt = 0;
  let onRemoteUpdateCallback = null;

  function getLocalData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { entries: [] };
    } catch {
      return { entries: [] };
    }
  }

  function setLocalData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getLocalSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return { babyName: parsed.babyName || 'Ediz' };
    } catch {
      return { babyName: 'Ediz' };
    }
  }

  function setLocalSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      babyName: settings.babyName || 'Ediz'
    }));
  }

  function getSeedEntries() {
    if (!window.BEBIS_SEED || !window.BEBIS_SEED.entries) return [];
    return window.BEBIS_SEED.entries;
  }

  function mergeEntries(a, b) {
    const map = new Map();
    (a || []).concat(b || []).forEach(function (entry) {
      if (entry && entry.id) map.set(entry.id, entry);
    });
    return Array.from(map.values()).sort(function (x, y) {
      return new Date(x.timestamp) - new Date(y.timestamp);
    });
  }

  function mergeAllSources(localEntries, seedEntries, remoteEntries) {
    return mergeEntries(mergeEntries(localEntries, seedEntries), remoteEntries);
  }

  function entriesSignature(entries) {
    return (entries || []).map(function (e) { return e.id; }).join(',');
  }

  function applyRemote(remote) {
    const local = getLocalData();
    const mergedEntries = mergeEntries(local.entries, remote.entries);
    const localSettings = getLocalSettings();
    const remoteSettings = remote.settings || {};

    const entriesChanged = entriesSignature(local.entries) !== entriesSignature(mergedEntries);
    const settingsChanged = (remoteSettings.babyName || 'Ediz') !== (localSettings.babyName || 'Ediz');

    if (!entriesChanged && !settingsChanged) return false;

    setLocalData({ entries: mergedEntries });
    if (remoteSettings.babyName) {
      setLocalSettings({ babyName: remoteSettings.babyName });
    }
    if (remote.entries && remote.entries.length > 0) {
      localStorage.setItem(SEED_FLAG, '1');
    }
    return true;
  }

  function buildPayload(data, settings) {
    return {
      entries: data.entries || [],
      settings: { babyName: settings.babyName || 'Ediz' },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  async function bootstrap() {
    const docRef = db.collection(DOC_COLLECTION).doc(DOC_ID);
    const snap = await docRef.get();

    const localData = getLocalData();
    const localSettings = getLocalSettings();
    const seedEntries = getSeedEntries();
    const seedSettings = window.BEBIS_SEED && window.BEBIS_SEED.settings;
    const remoteData = snap.exists ? snap.data() : null;
    const remoteEntries = remoteData ? (remoteData.entries || []) : [];

    const mergedEntries = mergeAllSources(localData.entries, seedEntries, remoteEntries);
    const mergedSettings = {
      babyName: (remoteData && remoteData.settings && remoteData.settings.babyName)
        || (seedSettings && seedSettings.babyName)
        || localSettings.babyName
        || 'Ediz'
    };

    setLocalData({ entries: mergedEntries });
    setLocalSettings(mergedSettings);
    if (mergedEntries.length > 0) {
      localStorage.setItem(SEED_FLAG, '1');
    }

    const needsUpload = !snap.exists || mergedEntries.length > remoteEntries.length
      || entriesSignature(mergedEntries) !== entriesSignature(remoteEntries);

    if (needsUpload && mergedEntries.length > 0) {
      ignoreNextSnapshot = true;
      lastPushAt = Date.now();
      await docRef.set(buildPayload({ entries: mergedEntries }, mergedSettings));
      setTimeout(function () { ignoreNextSnapshot = false; }, 800);
    }

    return { entryCount: mergedEntries.length, uploaded: needsUpload && mergedEntries.length > 0 };
  }

  function startListener() {
    if (unsubscribe) unsubscribe();
    unsubscribe = db.collection(DOC_COLLECTION).doc(DOC_ID).onSnapshot(function (snap) {
      if (!snap.exists) return;
      if (ignoreNextSnapshot) return;
      if (Date.now() - lastPushAt < 1200) return;

      const changed = applyRemote(snap.data());
      if (changed && onRemoteUpdateCallback) onRemoteUpdateCallback();
    }, function (err) {
      console.error('Firestore dinleyici hatası:', err);
    });
  }

  async function pushToFirestore(data, settings) {
    if (!db) return;
    try {
      lastPushAt = Date.now();
      ignoreNextSnapshot = true;
      const docRef = db.collection(DOC_COLLECTION).doc(DOC_ID);
      const snap = await docRef.get();
      let entries = data.entries || [];

      if (snap.exists) {
        entries = mergeEntries(entries, snap.data().entries);
      }

      await docRef.set({
        entries: entries,
        settings: { babyName: (settings && settings.babyName) || 'Ediz' },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      setLocalData({ entries: entries });
    } catch (err) {
      console.error('Firestore kayıt hatası:', err);
    } finally {
      setTimeout(function () { ignoreNextSnapshot = false; }, 800);
    }
  }

  async function init(onRemoteUpdate) {
    onRemoteUpdateCallback = onRemoteUpdate;

    if (!window.firebase) {
      console.warn('Firebase SDK yüklenemedi');
      return false;
    }

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      const bootstrapResult = await bootstrap();
      startListener();
      return bootstrapResult || { entryCount: 0, uploaded: false };
    } catch (err) {
      console.error('Firestore başlatma hatası:', err);
      return false;
    }
  }

  window.FirestoreSync = {
    init: init,
    push: pushToFirestore,
    isReady: function () { return !!db; }
  };
})();
