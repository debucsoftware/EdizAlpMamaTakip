# Bebiş Takip 👶

Bebeğin süt/mama beslenmesini ve kaka takibini kolayca yapmanızı sağlayan mobil uyumlu web uygulaması.

🌐 **Canlı uygulama:** [https://debucsoftware.github.io/EdizAlpMamaTakip/](https://debucsoftware.github.io/EdizAlpMamaTakip/)

## Özellikler

- 🍼 **Süt** ve 🍶 **Mama** kaydı (ml cinsinden)
- 💩 **Kaka** kaydı
- 📊 Günlük özet (toplam ml, beslenme sayısı, kaka sayısı)
- 📋 Saatlik detaylı kayıt listesi
- 📄 Günlük rapor (kopyala / paylaş)
- 📅 Son 14 günün geçmiş özeti
- 📱 Telefondan kolay kullanım
- 🔒 Veriler cihazda saklanır (localStorage)

## GitHub Pages'e Deploy

1. GitHub'da yeni bir repo oluşturun (örn: `bebistakip`)
2. Bu klasördeki dosyaları repoya yükleyin:

```bash
git init
git add .
git commit -m "Bebiş takip uygulaması"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/bebistakip.git
git push -u origin main
```

3. GitHub repo → **Settings** → **Pages**
4. **Source**: `Deploy from a branch`
5. **Branch**: `main` / `/ (root)`
6. **Save**

Birkaç dakika sonra siteniz şu adreste yayında olur:
`https://KULLANICI_ADINIZ.github.io/bebistakip/`

## Telefona Ekleme

Telefondan siteyi açın → tarayıcı menüsünden **Ana Ekrana Ekle** seçeneğini kullanın. Böylece uygulama gibi tek dokunuşla açılır.

## Kullanım

1. ⚙️ Ayarlardan bebeğin adını girin
2. Süt / Mama / Kaka sekmesini seçin
3. Miktar (ml) ve saati girin → **Kaydet**
4. **Rapor Al** ile günlük özeti kopyalayın veya paylaşın

## Not

Veriler tarayıcının localStorage'ında saklanır. Tarayıcı verilerini silerseniz kayıtlar da silinir. Farklı cihazlar arasında otomatik senkronizasyon yoktur.
