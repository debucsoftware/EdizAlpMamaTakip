/**
 * Ediz geçmiş kayıtları → js/seed-data.js
 * Bugün: 2026-06-11 Perşembe
 */
const fs = require('fs');
const path = require('path');

const TODAY = '2026-06-11';
let idCounter = 0;

function mkId() {
  idCounter++;
  return 'seed' + idCounter.toString(36).padStart(6, '0');
}

function dateOffset(daysFromToday) {
  const d = new Date(TODAY + 'T12:00:00');
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

function ts(dayOffset, time) {
  const date = dateOffset(dayOffset);
  const t = time.replace('.', ':');
  const parts = t.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);
  const d = new Date(date + 'T12:00:00');
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const entries = [];

function feed(day, time, sut, mama, note) {
  if (sut) entries.push({ id: mkId(), type: 'sut', amount: sut, timestamp: ts(day, time), note: note || undefined });
  if (mama) entries.push({ id: mkId(), type: 'mama', amount: mama, timestamp: ts(day, time), note: note || undefined });
  if (!sut && !mama && note) {
    entries.push({ id: mkId(), type: 'emdi', timestamp: ts(day, time), note });
  }
}

function bez(day, time, note) {
  entries.push({ id: mkId(), type: 'kaka', timestamp: ts(day, time), note: note || 'bez' });
}

const D = {
  hospital: -22,
  carsHastane: -21,
  persHastane: -20,
  cuma1: -19,
  cmt1: -18,
  pazar1: -17,
  pzt1: -16,
  cars2: -15,
  pers2: -14,
  cuma2: -13,
  cmt2: -12,
  pazar2: -11,
  pzt2: -10,
  sali2: -9,
  cars3: -8,
  pers3: -7,
  cuma3: -6,
  cmt3: -5,
  pazar3: -4,
  pzt3: -3,
  sali3: -2,
  cars4: -1,
  persToday: 0,
};

// --- Hastane beslenme ---
feed(D.hospital, '15:20', 20, 40);
feed(D.hospital, '18:45', 50, 0);
feed(D.hospital, '22:28', 60, 30);
feed(D.hospital, '23:15', 20, 0);
feed(D.hospital + 1, '02:45', 60, 25);
feed(D.hospital + 1, '05:45', 55, 0, '12 dk emdi');
feed(D.hospital + 1, '07:10', 20, 0);

// Hastane çıkışı Perş beslenme
feed(D.persHastane, '11:02', 45, 35, '15 dk emdi');
feed(D.persHastane, '15:30', 60, 0, '5-10 dk emdi');
feed(D.persHastane, '18:50', 75, 30, '23 dk emdi');
feed(D.persHastane + 1, '00:20', 80, 30);
feed(D.persHastane + 1, '03:20', 0, 80);

// Kaka Çarş (hastane)
['kaka+çiş', 'çiş', 'çiş+kaka', 'çiş', 'kaka', 'kaka+çiş'].forEach((n, i) => {
  bez(D.carsHastane, `${8 + i * 2}:00`, '1 bez ' + n);
});

// Kaka Perş (hastane çıkışı)
['kaka+çiş', 'çiş', 'çiş', 'kaka', 'kaka+çiş'].forEach((n, i) => {
  bez(D.persHastane, `${9 + i * 2}:30`, '1 bez ' + n);
});

// Cuma 1
feed(D.cuma1, '07:45', 70, 0, '25 dk emdi');
feed(D.cuma1, '10:45', 70, 20, '20 dk emdi');
feed(D.cuma1, '14:25', 70, 0, '20 dk emdi');
feed(D.cuma1, '15:40', 20, 0);
feed(D.cuma1, '18:10', 60, 0, '20 dk emdi');
feed(D.cuma1, '20:05', 0, 20);
feed(D.cuma1, '23:00', 85, 0, '13 dk emdi');
feed(D.cuma1 + 1, '03:10', 0, 85, 'çok az kusmuş');
['kaka+çiş', 'kaka+çiş', 'kaka+çiş', 'kaka+çiş', 'çiş', 'çiş+kaka', 'çiş+kaka'].forEach((n, i) => {
  bez(D.cuma1, `${8 + i * 2}:15`, '1 bez ' + n);
});

// Cmt 1
feed(D.cmt1, '07:05', 85, 0, '12 dk emdi');
feed(D.cmt1, '11:45', 80, 0, '5 dk emdi');
feed(D.cmt1, '16:00', 110, 0, '15 dk emdi');
feed(D.cmt1, '21:45', 85, 0, '10 dk emdi');
feed(D.cmt1 + 1, '02:30', 70, 30, '10 dk emdi');
feed(D.cmt1 + 1, '06:30', 0, 0, 'kayıt eksik');
['kaka+çiş', 'kaka+çiş', 'çiş', 'kaka+çiş', 'kaka+çiş', 'kaka+çiş', 'çiş', 'çiş az kaka (yeşil)'].forEach((n, i) => {
  bez(D.cmt1, `${7 + i * 2}:00`, '1 bez ' + n);
});

// Pazar 1
feed(D.pazar1, '07:30', 85, 0, '20 dk emdi');
feed(D.pazar1, '11:00', 60, 20, '20 dk emdi');
feed(D.pazar1, '14:30', 50, 0, '20 dk emdi');
feed(D.pazar1, '16:20', 0, 30);
feed(D.pazar1, '19:00', 90, 0, '10 dk emdi');
feed(D.pazar1, '20:33', 20, 0);
feed(D.pazar1, '22:50', 50, 40, '10 dk emdi');
feed(D.pazar1 + 1, '04:45', 105, 0, '10 dk emdi');
bez(D.pazar1, '07:00', '1 bez kaka+çiş');
bez(D.pazar1, '11:00', '1 bez kaka+çiş');
bez(D.pazar1, '14:30', '1 bez kaka+çiş');
bez(D.pazar1, '18:45', '1 bez kaka+çiş');
bez(D.pazar1, '22:50', '1 bez kaka+çiş');
bez(D.pazar1 + 1, '05:00', '1 bez kaka+çiş');
bez(D.pazar1 + 1, '08:30', '1 bez kaka+çiş');

// Pzt 1
feed(D.pzt1, '08:30', 55, 45);
feed(D.pzt1, '11:30', 55, 45);
feed(D.pzt1, '15:00', 80, 20, '5 dk emdi');
feed(D.pzt1, '19:00', 70, 40, '2-3 dk emdi');
feed(D.pzt1, '23:45', 60, 45, '15 dk emdi');
feed(D.pzt1 + 1, '04:00', 65, 20);
feed(D.pzt1 + 1, '08:30', 90, 0);
feed(D.pzt1 + 1, '11:00', 0, 30);
feed(D.pzt1 + 1, '16:00', 60, 0);
feed(D.pzt1 + 1, '17:00', 50, 0);
feed(D.pzt1 + 1, '20:00', 0, 0, 'kayıt eksik');
bez(D.pzt1, '08:30', '1 bez kaka+çiş');
bez(D.pzt1, '11:30', '1 bez kaka+çiş');
bez(D.pzt1, '15:00', '1 bez kaka+çiş');
bez(D.pzt1, '19:00', '1 bez kaka+çiş');
bez(D.pzt1, '23:00', '1 bez çiş');
bez(D.pzt1 + 1, '04:15', '1 bez kaka+çiş');
bez(D.pzt1 + 1, '08:30', '1 bez az kaka+çiş');

// Çarş 2
feed(D.cars2, '05:00', 70, 30);
bez(D.cars2, '05:15', '1 bez çiş');
bez(D.cars2, '05:30', '1 bez kaka');
feed(D.cars2, '08:30', 80, 0, '20 dk emdi');
bez(D.cars2, '08:45', '1 bez kaka+çiş');
feed(D.cars2, '14:00', 85, 0, '15 dk emdi');
bez(D.cars2, '14:30', '1 bez az kaka+çiş');
feed(D.cars2, '16:00', 0, 30);
feed(D.cars2, '18:50', 25, 0);
bez(D.cars2, '18:55', '1 bez kaka+çiş');
feed(D.cars2, '19:10', 0, 30);
feed(D.cars2, '19:30', 25, 0);
feed(D.cars2, '23:00', 100, 0, '20 dk emdi');
bez(D.cars2, '23:30', '1 bez kaka+çiş');
feed(D.cars2 + 1, '04:30', 90, 0);
bez(D.cars2 + 1, '04:45', '1 bez çiş');

// Perş 2
feed(D.pers2, '09:00', 85, 0, '15 dk emdi');
bez(D.pers2, '09:15', '1 bez kaka+çiş');
feed(D.pers2, '14:00', 90, 0, '15 dk emdi');
bez(D.pers2, '14:30', '1 bez çiş');
feed(D.pers2, '17:00', 0, 30);
bez(D.pers2, '17:05', '1 bez çiş+kaka');
feed(D.pers2, '18:00', 75, 0);
bez(D.pers2, '18:15', '1 bez çiş');
feed(D.pers2, '22:00', 100, 0, '10 dk emdi');
bez(D.pers2, '22:30', '1 bez çiş+kaka');
feed(D.pers2 + 1, '03:30', 100, 15);
bez(D.pers2 + 1, '03:45', '1 bez çiş, çok az kaka');
feed(D.pers2 + 1, '07:30', 72, 0);
bez(D.pers2 + 1, '07:45', '1 bez kaka+çiş');

// Cuma 2
feed(D.cuma2, '11:30', 100, 0, '10 dk emdi');
bez(D.cuma2, '11:45', '1 bez kaka+çiş');
feed(D.cuma2, '14:00', 65, 0);
bez(D.cuma2, '14:15', '1 bez kaka+çiş');
feed(D.cuma2, '17:30', 75, 0);
bez(D.cuma2, '17:45', '1 bez az kaka+çiş');
feed(D.cuma2, '19:00', 0, 30);
feed(D.cuma2, '22:30', 95, 0);
bez(D.cuma2, '22:45', '1 bez çiş');
feed(D.cuma2 + 1, '03:00', 105, 0);
bez(D.cuma2 + 1, '03:15', '1 bez çiş, çok az kaka');

// Cmt 2
feed(D.cmt2, '07:30', 85, 0);
bez(D.cmt2, '07:45', '1 bez çiş, çok az kaka');
feed(D.cmt2, '12:30', 45, 0, '20 dk emdi');
bez(D.cmt2, '12:45', '1 bez kaka+çiş');
feed(D.cmt2, '13:30', 50, 0);
feed(D.cmt2, '16:00', 0, 60);
bez(D.cmt2, '16:15', '1 bez kaka+çiş');
feed(D.cmt2, '20:00', 85, 0);
bez(D.cmt2, '20:15', '1 bez kaka+çiş');
feed(D.cmt2, '20:30', 0, 15);
feed(D.cmt2, '22:30', 0, 25);
bez(D.cmt2, '22:45', '1 bez çiş, az kaka');
feed(D.cmt2 + 1, '00:00', 60, 0);
feed(D.cmt2 + 1, '04:30', 85, 0);
bez(D.cmt2 + 1, '04:45', '1 bez çiş');

// Pazar 2
feed(D.pazar2, '08:00', 70, 0, '20 dk emdi');
bez(D.pazar2, '08:15', '1 bez çiş');
feed(D.pazar2, '12:00', 90, 0, '15 dk emdi');
bez(D.pazar2, '12:15', '1 bez çiş');
feed(D.pazar2, '15:30', 75, 30, '10 dk emdi');
bez(D.pazar2, '15:45', '1 bez çiş');
bez(D.pazar2, '15:50', '1 bez kaka+çiş');
feed(D.pazar2, '21:00', 100, 0, '5 dk emdi');
bez(D.pazar2, '21:15', '1 bez çiş, çok az kaka');
feed(D.pazar2 + 1, '01:30', 90, 0, '5 dk emdi');
bez(D.pazar2 + 1, '01:45', '1 bez kaka+çiş');

// Pzt 2 (kaşık biberon)
feed(D.pzt2, '06:00', 80, 0, '20 dk emdi');
bez(D.pzt2, '06:15', '1 bez kaka+çiş');
feed(D.pzt2, '10:50', 45, 0, '15 dk emdi');
bez(D.pzt2, '11:05', '1 bez çiş, az kaka');
feed(D.pzt2, '12:30', 60, 0);
feed(D.pzt2, '17:00', 80, 0, '10 dk emdi');
bez(D.pzt2, '14:00', '1 bez kaka+çiş');
bez(D.pzt2, '16:00', '1 bez kaka+çiş');
bez(D.pzt2, '18:00', '1 bez kaka+çiş');
feed(D.pzt2, '21:00', 85, 0);
bez(D.pzt2, '21:15', '1 bez az kaka+çiş');
feed(D.pzt2 + 1, '02:30', 80, 0);
bez(D.pzt2 + 1, '02:45', '1 bez az kaka+çiş');

// Salı 2
feed(D.sali2, '07:30', 85, 0);
bez(D.sali2, '07:45', '1 bez bol kaka+çiş');
feed(D.sali2, '11:00', 0, 40);
bez(D.sali2, '11:15', '1 bez çiş, az kaka');
feed(D.sali2, '13:00', 0, 60);
bez(D.sali2, '13:15', '1 bez çiş, az kaka');
feed(D.sali2, '14:00', 0, 40);
bez(D.sali2, '14:15', '1 bez çiş, az kaka');
feed(D.sali2, '17:00', 0, 0, '27 dk kesintisiz emdi');
feed(D.sali2, '18:30', 50, 0);
bez(D.sali2, '18:45', '1 bez çiş, az kaka');
feed(D.sali2, '21:00', 70, 0);
feed(D.sali2 + 1, '02:30', 50, 60, '15 dk emdi');
bez(D.sali2 + 1, '02:45', '1 bez çiş, az kaka');

// Çarş 3
feed(D.cars3, '06:00', 60, 0);
bez(D.cars3, '06:15', '1 bez çiş');
feed(D.cars3, '09:00', 80, 30, '10 dk emdi');
bez(D.cars3, '09:15', '1 bez çiş');
feed(D.cars3, '14:30', 65, 60, '10 dk emdi');
bez(D.cars3, '14:45', '1 bez kaka+çiş');
feed(D.cars3, '18:00', 80, 0, '5 dk emdi');
bez(D.cars3, '18:15', '1 bez çiş, az kaka');
feed(D.cars3, '19:00', 0, 30);
bez(D.cars3, '19:15', '1 bez çiş, az kaka');
feed(D.cars3, '23:30', 55, 60);
bez(D.cars3, '23:45', '1 bez çiş');
feed(D.cars3 + 1, '03:30', 70, 30, '5-10 dk emdi');
bez(D.cars3 + 1, '03:45', '1 bez çiş');

// Perş 3 (Top 370 süt 180 mama)
feed(D.pers3, '07:30', 20, 60, '10-15 dk emdi');
bez(D.pers3, '07:45', '1 bez bol çiş, bol kaka');
feed(D.pers3, '12:30', 40, 30, '10 dk emdi');
bez(D.pers3, '12:45', '1 bez çiş, az kaka');
feed(D.pers3, '14:30', 50, 0);
bez(D.pers3, '14:45', '1 bez çiş');
feed(D.pers3, '17:00', 100, 0);
bez(D.pers3, '17:15', '1 bez az kaka+çiş');
feed(D.pers3, '19:00', 0, 30);
feed(D.pers3, '23:00', 100, 0);
bez(D.pers3, '23:15', '1 bez bol çiş');
feed(D.pers3 + 1, '00:00', 0, 30);
feed(D.pers3 + 1, '04:30', 60, 0);
bez(D.pers3 + 1, '04:45', '1 bez çiş');
feed(D.pers3 + 1, '05:00', 0, 30);

// Cuma 3 (240 mama 405 süt)
feed(D.cuma3, '08:00', 0, 30, '20 dk emdi');
bez(D.cuma3, '08:15', '1 bez çiş');
feed(D.cuma3, '09:00', 85, 0);
bez(D.cuma3, '09:15', '1 bez kaka+çiş');
feed(D.cuma3, '12:30', 0, 30, '5-10 dk emdi');
bez(D.cuma3, '12:45', '1 bez çişli');
feed(D.cuma3, '13:30', 60, 0);
feed(D.cuma3, '14:00', 0, 30);
bez(D.cuma3, '14:15', '1 bez bol kaka+çiş');
feed(D.cuma3, '15:00', 0, 30);
feed(D.cuma3, '18:30', 0, 30, '5-10 dk emdi');
bez(D.cuma3, '18:45', '1 bez çiş');
feed(D.cuma3, '19:30', 90, 0);
feed(D.cuma3, '21:30', 0, 60);
feed(D.cuma3 + 1, '02:00', 95, 0);
feed(D.cuma3 + 1, '05:00', 75, 30);
bez(D.cuma3 + 1, '05:15', '1 bez çiş');

// Cmt 3 (200 mama 325 süt)
feed(D.cmt3, '09:00', 0, 0, '1 saat 30 dk emdi');
bez(D.cmt3, '09:15', '1 bez çişli');
feed(D.cmt3, '12:30', 0, 60);
bez(D.cmt3, '12:45', '1 bez çişli');
feed(D.cmt3, '16:00', 0, 0, '10 dk emdi');
feed(D.cmt3, '16:20', 60, 0);
bez(D.cmt3, '16:35', '1 bez çişli');
feed(D.cmt3, '17:10', 65, 0);
feed(D.cmt3, '21:30', 40, 60);
bez(D.cmt3, '21:45', '1 bez çişli');
feed(D.cmt3, '22:15', 0, 20);
feed(D.cmt3 + 1, '01:30', 0, 60);
bez(D.cmt3 + 1, '01:45', '1 bez orta çişli');
feed(D.cmt3 + 1, '02:30', 70, 0);
feed(D.cmt3 + 1, '04:30', 90, 0);
bez(D.cmt3 + 1, '04:45', '1 bez bol kaka+çiş');

// Pazar 3 (180 mama 475 süt)
feed(D.pazar3, '08:00', 35, 0);
feed(D.pazar3, '08:30', 35, 0);
bez(D.pazar3, '08:35', '1 bez çişli');
feed(D.pazar3, '09:00', 0, 30);
feed(D.pazar3, '12:00', 60, 0);
bez(D.pazar3, '12:15', '1 bez çişli');
feed(D.pazar3, '13:15', 50, 0);
feed(D.pazar3, '17:30', 70, 60);
bez(D.pazar3, '17:45', '1 bez kaka+çiş');
feed(D.pazar3, '21:30', 80, 0);
feed(D.pazar3, '22:20', 0, 30);
bez(D.pazar3, '22:35', '1 bez çişli');
feed(D.pazar3, '23:15', 0, 30);
feed(D.pazar3 + 1, '01:30', 85, 0);
bez(D.pazar3 + 1, '01:45', '1 bez çişli');
feed(D.pazar3 + 1, '04:00', 60, 0);
bez(D.pazar3 + 1, '04:15', '1 bez çişli');
feed(D.pazar3 + 1, '05:45', 0, 30);
bez(D.pazar3 + 1, '06:00', '1 bez bol kaka');

// Pzt 3 (180 mama 470 süt)
feed(D.pzt3, '09:00', 0, 60);
feed(D.pzt3, '09:30', 0, 30);
bez(D.pzt3, '09:35', '1 bez az çiş');
feed(D.pzt3, '13:00', 75, 0);
bez(D.pzt3, '13:15', '1 bez az kaka, az çiş');
feed(D.pzt3, '14:10', 50, 0);
feed(D.pzt3, '16:30', 100, 0);
bez(D.pzt3, '16:45', '1 bez çişli, az kaka');
feed(D.pzt3, '18:30', 0, 30);
bez(D.pzt3, '18:45', '1 bez kaka+çiş');
feed(D.pzt3, '20:15', 0, 30);
feed(D.pzt3, '23:00', 105, 0);
bez(D.pzt3, '23:15', '1 bez çişli');
feed(D.pzt3 + 1, '02:30', 80, 0);
bez(D.pzt3 + 1, '02:45', '1 bez çişli');
feed(D.pzt3 + 1, '05:30', 60, 30);
bez(D.pzt3 + 1, '05:45', '1 bez çişli');

// Salı 3 (120 mama 510 süt)
feed(D.sali3, '08:30', 0, 60);
bez(D.sali3, '08:45', '1 bez çişli, az kaka');
feed(D.sali3, '09:00', 50, 0);
feed(D.sali3, '12:30', 90, 0);
bez(D.sali3, '12:45', '1 bez çişli');
feed(D.sali3, '16:30', 0, 30);
bez(D.sali3, '16:45', '1 bez bol kaka+çiş');
feed(D.sali3, '17:00', 80, 0);
feed(D.sali3, '20:00', 80, 0);
bez(D.sali3, '20:15', '1 bez kaka+çiş');
feed(D.sali3, '20:40', 40, 0);
feed(D.sali3, '21:45', 0, 30);
feed(D.sali3 + 1, '01:30', 80, 0);
feed(D.sali3 + 1, '04:30', 90, 0);

// Çarş 4 (90 mama 585 süt)
feed(D.cars4, '08:00', 105, 0);
bez(D.cars4, '08:15', '1 bez çiş');
feed(D.cars4, '11:30', 0, 30);
bez(D.cars4, '11:45', '1 bez çiş');
feed(D.cars4, '12:30', 50, 0);
bez(D.cars4, '12:45', '1 bez kaka');
feed(D.cars4, '13:30', 35, 0);
feed(D.cars4, '16:30', 40, 0);
bez(D.cars4, '16:45', '1 bez kakalı');
feed(D.cars4, '17:30', 35, 0);
feed(D.cars4, '18:00', 0, 30);
feed(D.cars4, '21:30', 60, 0);
bez(D.cars4, '21:45', '1 bez bol çişli');
feed(D.cars4, '22:00', 60, 0);
feed(D.cars4 + 1, '02:00', 110, 0);
feed(D.cars4 + 1, '05:50', 90, 30);
bez(D.cars4 + 1, '06:05', '1 bez bol çiş');

// Perş bugün
feed(D.persToday, '08:20', 25, 0);
bez(D.persToday, '08:25', '1 bez orta kaka+çiş');

entries.forEach(e => {
  if (!e.note) delete e.note;
});

const out = `/* Ediz geçmiş kayıtları - otomatik üretildi */\nwindow.BEBIS_SEED = ${JSON.stringify({
  settings: { babyName: 'Ediz' },
  entries: entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
})};\n`;

const outPath = path.join(__dirname, '..', 'js', 'seed-data.js');
fs.writeFileSync(outPath, out, 'utf8');
console.log('Yazıldı:', outPath, '-', entries.length, 'kayıt');
