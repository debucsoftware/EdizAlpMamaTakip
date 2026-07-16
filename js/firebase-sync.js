(function () {
  'use strict';

  const DOC_COLLECTION = 'app';
  const DOC_ID = 'ediz';
  const DEFAULT_BABY_NAME = 'Ediz';

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
  let onRemoteUpdateCallback = null;
  let ready = false;
  let pushChain = Promise.resolve();
  let ignoreSnapshotUntil = 0;

  const state = {
    entries: [],
    deletedIds: [],
    settings: {
      babyName: DEFAULT_BABY_NAME,
      currentWeightG: null,
      currentHeightCm: null
    }
  };

  function getSeedEntries() {
    if (!window.BEBIS_SEED || !window.BEBIS_SEED.entries) return [];
    return window.BEBIS_SEED.entries;
  }

  function uniqueIds(ids) {
    return Array.from(new Set((ids || []).filter(Boolean)));
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

  function filterDeleted(entries, deletedIds) {
    const deleted = new Set(deletedIds || []);
    return (entries || []).filter(function (e) { return e && e.id && !deleted.has(e.id); });
  }

  function mergeRemoteIntoState(remoteEntries, remoteDeletedIds, localWins) {
    state.deletedIds = uniqueIds(state.deletedIds.concat(remoteDeletedIds || []));
    const merged = localWins
      ? mergeEntries(remoteEntries || [], state.entries)
      : mergeEntries(state.entries, remoteEntries || []);
    state.entries = filterDeleted(merged, state.deletedIds);
  }

  function entriesSignature(entries) {
    return (entries || []).map(function (e) {
      return [e.id, e.type, e.amount, e.timestamp, e.note || ''].join('|');
    }).sort().join(',');
  }

  function deletedSignature(ids) {
    return uniqueIds(ids).sort().join(',');
  }

  function isOnline() {
    return typeof navigator === 'undefined' || navigator.onLine;
  }

  async function fetchDocSnap(docRef) {
    if (isOnline()) {
      try {
        return await docRef.get({ source: 'server' });
      } catch (err) {
        console.warn('Sunucudan okunamadı, önbellek kullanılıyor:', err);
      }
    }
    return docRef.get();
  }

  function shouldApplySnapshot(snap) {
    if (ignoreNextSnapshot) return false;
    if (Date.now() < ignoreSnapshotUntil) return false;
    if (snap.metadata.fromCache && isOnline()) return false;
    return true;
  }

  function buildPayload() {
    return {
      entries: state.entries,
      deletedIds: state.deletedIds,
      settings: {
        babyName: state.settings.babyName || DEFAULT_BABY_NAME,
        currentWeightG: state.settings.currentWeightG || null,
        currentHeightCm: state.settings.currentHeightCm || null
      },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  function applyRemote(remote) {
    const remoteEntries = remote.entries || [];
    const remoteDeleted = remote.deletedIds || [];
    const remoteSettings = remote.settings || {};

    const prevEntriesSig = entriesSignature(state.entries);
    const prevDeletedSig = deletedSignature(state.deletedIds);
    const prevSettingsSig = JSON.stringify({
      babyName: state.settings.babyName || DEFAULT_BABY_NAME,
      currentWeightG: state.settings.currentWeightG || null,
      currentHeightCm: state.settings.currentHeightCm || null
    });

    mergeRemoteIntoState(remoteEntries, remoteDeleted);

    if (remoteSettings.babyName) {
      state.settings.babyName = remoteSettings.babyName;
    }
    if ('currentWeightG' in remoteSettings) {
      state.settings.currentWeightG = remoteSettings.currentWeightG || null;
    }
    if ('currentHeightCm' in remoteSettings) {
      state.settings.currentHeightCm = remoteSettings.currentHeightCm || null;
    }

    const entriesChanged = prevEntriesSig !== entriesSignature(state.entries);
    const deletedChanged = prevDeletedSig !== deletedSignature(state.deletedIds);
    const settingsChanged = JSON.stringify({
      babyName: state.settings.babyName || DEFAULT_BABY_NAME,
      currentWeightG: state.settings.currentWeightG || null,
      currentHeightCm: state.settings.currentHeightCm || null
    }) !== prevSettingsSig;

    return entriesChanged || deletedChanged || settingsChanged;
  }

  async function bootstrap() {
    const docRef = db.collection(DOC_COLLECTION).doc(DOC_ID);
    const snap = await fetchDocSnap(docRef);

    if (snap.exists) {
      const remote = snap.data();
      state.entries = filterDeleted(remote.entries || [], remote.deletedIds || []);
      state.deletedIds = uniqueIds(remote.deletedIds || []);
      state.settings.babyName = (remote.settings && remote.settings.babyName) || DEFAULT_BABY_NAME;
      state.settings.currentWeightG = remote.settings && remote.settings.currentWeightG ? remote.settings.currentWeightG : null;
      state.settings.currentHeightCm = remote.settings && remote.settings.currentHeightCm ? remote.settings.currentHeightCm : null;
      return { entryCount: state.entries.length, uploaded: false };
    }

    const seedEntries = getSeedEntries();
    const seedSettings = window.BEBIS_SEED && window.BEBIS_SEED.settings;
    state.entries = seedEntries.slice();
    state.deletedIds = [];
    state.settings.babyName = (seedSettings && seedSettings.babyName) || DEFAULT_BABY_NAME;
    state.settings.currentWeightG = null;
    state.settings.currentHeightCm = null;

    ignoreNextSnapshot = true;
    ignoreSnapshotUntil = Date.now() + 1500;
    await docRef.set(buildPayload());
    setTimeout(function () { ignoreNextSnapshot = false; }, 1500);

    return {
      entryCount: state.entries.length,
      uploaded: state.entries.length > 0
    };
  }

  function startListener() {
    if (unsubscribe) unsubscribe();
    unsubscribe = db.collection(DOC_COLLECTION).doc(DOC_ID).onSnapshot(function (snap) {
      if (!snap.exists) return;
      if (!shouldApplySnapshot(snap)) return;

      const changed = applyRemote(snap.data());
      if (changed && onRemoteUpdateCallback) onRemoteUpdateCallback();
    }, function (err) {
      console.error('Firestore dinleyici hatası:', err);
    });
  }

  async function pushToFirestoreNow() {
    if (!db) return;
    const docRef = db.collection(DOC_COLLECTION).doc(DOC_ID);

    try {
      ignoreNextSnapshot = true;
      ignoreSnapshotUntil = Date.now() + 1500;
      const snap = await fetchDocSnap(docRef);
      const remote = snap.exists ? snap.data() : {};
      mergeRemoteIntoState(remote.entries || [], remote.deletedIds || [], true);

      await docRef.set(buildPayload());
    } catch (err) {
      console.error('Firestore kayıt hatası:', err);
      throw err;
    } finally {
      setTimeout(function () { ignoreNextSnapshot = false; }, 1500);
    }
  }

  function pushToFirestore() {
    if (!db) return Promise.resolve();
    pushChain = pushChain.then(pushToFirestoreNow).catch(function (err) {
      console.error('Firestore yazma kuyruğu hatası:', err);
      throw err;
    });
    return pushChain;
  }

  function getData() {
    return { entries: state.entries.slice() };
  }

  function getSettings() {
    return {
      babyName: state.settings.babyName || DEFAULT_BABY_NAME,
      currentWeightG: state.settings.currentWeightG || null,
      currentHeightCm: state.settings.currentHeightCm || null
    };
  }

  function saveData(data) {
    const incoming = filterDeleted(data.entries || [], state.deletedIds);
    state.entries = mergeEntries(state.entries, incoming);
    state.entries = filterDeleted(state.entries, state.deletedIds);
    return pushToFirestore();
  }

  function updateEntry(entry) {
    if (!entry || !entry.id) return Promise.resolve();
    state.entries = mergeEntries(state.entries, [entry]);
    state.entries = filterDeleted(state.entries, state.deletedIds);
    return pushToFirestore();
  }

  function deleteEntry(id) {
    if (!id) return Promise.resolve();
    state.deletedIds = uniqueIds(state.deletedIds.concat(id));
    state.entries = state.entries.filter(function (e) { return e.id !== id; });
    return pushToFirestore();
  }

  function saveSettings(settings) {
    if (settings && settings.babyName) {
      state.settings.babyName = settings.babyName;
    }
    if (settings && 'currentWeightG' in settings) {
      state.settings.currentWeightG = settings.currentWeightG || null;
    }
    if (settings && 'currentHeightCm' in settings) {
      state.settings.currentHeightCm = settings.currentHeightCm || null;
    }
    return pushToFirestore();
  }

  async function init(onRemoteUpdate) {
    onRemoteUpdateCallback = onRemoteUpdate;
    ready = false;

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
      ready = true;
      return bootstrapResult || { entryCount: 0, uploaded: false };
    } catch (err) {
      console.error('Firestore başlatma hatası:', err);
      return false;
    }
  }

  window.FirestoreSync = {
    init: init,
    isReady: function () { return ready; },
    getData: getData,
    getSettings: getSettings,
    saveData: saveData,
    updateEntry: updateEntry,
    deleteEntry: deleteEntry,
    saveSettings: saveSettings
  };
})();
