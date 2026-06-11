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
  let lastPushAt = 0;
  let onRemoteUpdateCallback = null;
  let ready = false;

  const state = {
    entries: [],
    settings: { babyName: DEFAULT_BABY_NAME }
  };

  function getSeedEntries() {
    if (!window.BEBIS_SEED || !window.BEBIS_SEED.entries) return [];
    return window.BEBIS_SEED.entries;
  }

  function entriesSignature(entries) {
    return (entries || []).map(function (e) { return e.id; }).join(',');
  }

  function buildPayload() {
    return {
      entries: state.entries,
      settings: { babyName: state.settings.babyName || DEFAULT_BABY_NAME },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  function applyRemote(remote) {
    const remoteEntries = remote.entries || [];
    const remoteSettings = remote.settings || {};
    const entriesChanged = entriesSignature(state.entries) !== entriesSignature(remoteEntries);
    const settingsChanged = (remoteSettings.babyName || DEFAULT_BABY_NAME)
      !== (state.settings.babyName || DEFAULT_BABY_NAME);

    if (!entriesChanged && !settingsChanged) return false;

    state.entries = remoteEntries;
    if (remoteSettings.babyName) {
      state.settings.babyName = remoteSettings.babyName;
    }
    return true;
  }

  async function bootstrap() {
    const docRef = db.collection(DOC_COLLECTION).doc(DOC_ID);
    const snap = await docRef.get();

    if (snap.exists) {
      const remote = snap.data();
      state.entries = remote.entries || [];
      state.settings.babyName = (remote.settings && remote.settings.babyName) || DEFAULT_BABY_NAME;
      return { entryCount: state.entries.length, uploaded: false };
    }

    const seedEntries = getSeedEntries();
    const seedSettings = window.BEBIS_SEED && window.BEBIS_SEED.settings;
    state.entries = seedEntries.slice();
    state.settings.babyName = (seedSettings && seedSettings.babyName) || DEFAULT_BABY_NAME;

    ignoreNextSnapshot = true;
    lastPushAt = Date.now();
    await docRef.set(buildPayload());
    setTimeout(function () { ignoreNextSnapshot = false; }, 800);

    return {
      entryCount: state.entries.length,
      uploaded: state.entries.length > 0
    };
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

  async function pushToFirestore() {
    if (!db) return;
    try {
      lastPushAt = Date.now();
      ignoreNextSnapshot = true;
      await db.collection(DOC_COLLECTION).doc(DOC_ID).set(buildPayload(), { merge: true });
    } catch (err) {
      console.error('Firestore kayıt hatası:', err);
      throw err;
    } finally {
      setTimeout(function () { ignoreNextSnapshot = false; }, 800);
    }
  }

  function getData() {
    return { entries: state.entries.slice() };
  }

  function getSettings() {
    return { babyName: state.settings.babyName || DEFAULT_BABY_NAME };
  }

  function saveData(data) {
    state.entries = (data.entries || []).slice();
    return pushToFirestore();
  }

  function saveSettings(settings) {
    if (settings && settings.babyName) {
      state.settings.babyName = settings.babyName;
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
    saveSettings: saveSettings
  };
})();
