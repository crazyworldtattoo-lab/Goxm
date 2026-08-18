# 👓 Sanal Gözlük Deneme (AR Virtual Try-On)

Optik dükkânı web sitesi için artırılmış gerçeklik (AR) ile sanal gözlük deneme uygulaması.
Müşteri kamerayı açar, gözlüğün yüzünde nasıl durduğunu gerçek zamanlı görür.

## Özellikler
- 📷 Gerçek zamanlı yüz takibi (MediaPipe Face Landmarker) — gözlük yüzle birlikte döner ve ölçeklenir
- 👓 6 farklı çerçeve modeli/rengi (klasik, güneş gözlüğü, altın, kırmızı…)
- 🖼️ Kamera yoksa fotoğraf yükleyerek deneme
- 📸 "Fotoğraf Çek" ile denenen gözlüklü görüntüyü indirme
- 🔒 Tüm işlem tarayıcıda yapılır; görüntü hiçbir sunucuya gönderilmez

## Çalıştırma
Statik dosyalardır, herhangi bir sunucu gerekmez. Yerelde denemek için:

```bash
python3 -m http.server 8000
# http://localhost:8000 adresini açın
```

> Not: Kamera erişimi için sayfa **https** üzerinden (veya localhost'tan) sunulmalıdır.

## Web sitenize ekleme
1. **Kendi sitenize kopyalama:** `index.html` ve `app.js` dosyalarını sitenize yükleyin, menüden link verin.
2. **iframe ile gömme:** Dosyaları bir alt sayfaya (örn. `/sanal-deneme/`) koyup mevcut sayfanıza gömün:

```html
<iframe src="/sanal-deneme/index.html" width="100%" height="800"
        allow="camera" style="border:none"></iframe>
```

`allow="camera"` özniteliği zorunludur.

## Kendi gözlük modellerinizi ekleme
`app.js` içindeki `CATALOG` listesine yeni satır ekleyin:

```js
{ name: "Model Adı", frame: 0x1a1a1a, lens: 0x88aacc, lensOpacity: 0.12, shape: "rect" }
```

- `frame`: çerçeve rengi (hex)
- `lens`: cam rengi; `lensOpacity`: cam koyuluğu (güneş gözlüğü için 0.7+)
- `shape`: `"rect"` (köşeli) veya `"round"` (yuvarlak)

İleride gerçek ürünlerinizin 3B taramaları (GLB dosyaları) da aynı sisteme eklenebilir.
