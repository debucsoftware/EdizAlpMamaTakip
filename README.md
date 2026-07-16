# Bebiş Takip 👶

Bebeğin süt, mama, emzirme ve bez takibini kolayca yapmanızı sağlayan mobil uyumlu web uygulaması.

🌐 **Canlı uygulama:** [https://debucsoftware.github.io/EdizAlpMamaTakip/](https://debucsoftware.github.io/EdizAlpMamaTakip/)

## Özellikler

### Kayıt ve takip
- 🍼 **Süt** ve 🍶 **Mama** kaydı (ml)
- 🤱 **Emzirme** kaydı (dakika)
- 💩 **Bez** kaydı (açıklama/not ile)
- ⏰ Tarih ve saat seçerek geçmişe dönük kayıt ekleme
- ✏️ Kayıtları düzenleme ve silme

### Özet ve tavsiye
- 📊 Günlük özet: süt, mama, toplam ml, emzirme süresi, bez sayısı
- 🌟 **Günlük Tavsiye**: Groq AI ile akıllı değerlendirme; API erişilemezse yerel tavsiye devreye girer
- Değerlendirme yalnızca bugüne değil, **son 7 günün geçmişi ve ortalamalarına** göre yapılır
- Bebeğin yaşına göre beslenme ve bez notları

### Raporlar
- 📄 **Günlük rapor** — detaylı özet, kopyala / paylaş
- 📊 **Haftalık rapor** — son 7 günün metin özeti ve grafiği
  - Sol eksen: **ml** (süt, mama, toplam çizgileri)
  - Sağ eksen: **dk** (emzirme süreleri, yeşil dikey çizgiler)
- 📅 **Geçmiş** sekmesinde tüm önceki günlerin özeti; güne tıklayarak rapor görüntüleme

### Diğer
- 📱 Telefondan kolay kullanım, ana ekrana eklenebilir
- ☁️ Kayıtlar **Firebase Firestore** üzerinde senkronize edilir
- 🔄 Cihazlar arası veri paylaşımı (aynı Firebase projesi üzerinden)

## Sekmeler

| Sekme | Açıklama |
|-------|----------|
| **Özet** | Bugünün istatistikleri ve günlük tavsiye |
| **Ekle** | Yeni beslenme / emzirme / bez kaydı |
| **Bugün** | Bugünkü kayıt listesi, günlük ve haftalık rapor |
| **Geçmiş** | Önceki günlerin özetleri |

## Proje yapısı

```
├── index.html          # Ana sayfa
├── css/style.css       # Stiller
├── js/
│   ├── app.js          # Uygulama mantığı
│   ├── firebase-sync.js # Firestore senkronizasyonu
│   └── seed-data.js    # Başlangıç verileri
├── firestore.rules     # Firestore güvenlik kuralları
└── scripts/
    └── generate-seed.js
```

## GitHub Pages'e Deploy

1. GitHub'da yeni bir repo oluşturun
2. Bu klasördeki dosyaları repoya yükleyin:

```bash
git init
git add .
git commit -m "Bebiş takip uygulaması"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/EdizAlpMamaTakip.git
git push -u origin main
```

3. GitHub repo → **Settings** → **Pages**
4. **Source**: `Deploy from a branch`
5. **Branch**: `main` / `/ (root)`
6. **Save**

Birkaç dakika sonra siteniz şu adreste yayında olur:
`https://KULLANICI_ADINIZ.github.io/EdizAlpMamaTakip/`

## Telefona Ekleme

Telefondan siteyi açın → tarayıcı menüsünden **Ana Ekrana Ekle** seçeneğini kullanın. Böylece uygulama gibi tek dokunuşla açılır.

## Kullanım

1. ⚙️ Ayarlardan bebeğin adını girin
2. **Ekle** sekmesinden Süt / Mama / Emzirme / Bez seçin
3. Miktar veya süreyi girin, tarih/saati ayarlayın → **Kaydet**
4. **Özet** sekmesinde günlük tavsiyeyi okuyun
5. **Bugün** sekmesinden **Rapor Al** veya **Haftalık Rapor** ile özet alın
6. **Geçmiş** sekmesinden önceki günleri inceleyin

## Notlar

- Beslenme kayıtları Firebase Firestore'da saklanır; internet bağlantısı gerektirir.
- AI tavsiyesi bilgilendirme amaçlıdır, doktor tavsiyesi yerine geçmez.
- AI önbelleği tarayıcıda (localStorage) tutulur; asıl kayıtlar bulutta kalır.
- Günlük hesaplamalar sabah 08:00'den itibaren başlar (gece kayıtları önceki güne yazılır).
