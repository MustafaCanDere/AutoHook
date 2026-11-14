'use strict';
/* More ready-made workflows for "Şablonlar". `build` comes from templates.js.
   Templates marked offline in LIST run without internet or accounts; the others need the credentials the gallery lists. */
module.exports = build => {
  const CUSTOMERS = JSON.stringify([
    { ad: 'Ayşe Yılmaz', eposta: 'ayse@ornek.com', telefon: '0532 123 45 67', sehir: 'İstanbul' },
    { ad: 'Mehmet Kaya', eposta: 'mehmet@ornek', telefon: '0505 111 22 33', sehir: 'Ankara' },
    { ad: 'Ayşe Yılmaz', eposta: 'ayse@ornek.com', telefon: '05321234567', sehir: 'İstanbul' },
    { ad: 'Elif Şahin', eposta: 'elif@ornek.com', telefon: '12345', sehir: 'İzmir' },
    { ad: 'Can Öztürk', eposta: 'can@ornek.com.tr', telefon: '+90 544 987 65 43', sehir: 'Bursa' },
    { ad: 'Selin Aydın', eposta: 'selin@ornek.com', telefon: '0 (216) 555 44 33', sehir: 'İstanbul' },
  ], null, 2);
  const PRODUCTS = JSON.stringify([
    { kod: 'KUP-1', ad: 'Seramik kupa', fiyat: 249.9, link: 'https://magazam.com/urun/kup-1' },
    { kod: 'TIS-2', ad: 'Pamuk tişört', fiyat: 399, link: 'https://magazam.com/urun/tis-2' },
    { kod: 'DEF-3', ad: 'Deri defter', fiyat: 189.5, link: 'https://magazam.com/urun/def-3' },
  ], null, 2);

  const TEMPLATES = {
    /* ---------- offline: run right away ---------- */
    tcknDogrula: () => build('T.C. kimlik no doğrulama API\'si', 'İnternetsiz çalışır. /webhook/tckn adresine gelen kimlik numarasını kontrol hanesiyle doğrular ve geçerli mi değil mi JSON olarak döner. Başvuru formları ve üyelik sayfaları için.', {
      wh: ['webhook', 0, 100, 'Numara geldi', { method: 'POST', path: 'tckn', respond: 'node', sample: '{\n  "tckn": "10000000146"\n}' }],
      vd: ['validate', 300, 100, 'TCKN doğru mu?', { kind: 'tckn', value: '{{ $json.body.tckn }}', output: 'dogrulama' }],
      ok: ['respond', 620, 20, 'Geçerli', { status: 200, type: 'json', body: '{{ JSON.stringify({ gecerli: true, tckn: $json.dogrulama.deger }) }}' }],
      no: ['respond', 620, 200, 'Geçersiz', { status: 422, type: 'json', body: '{{ JSON.stringify({ gecerli: false, neden: $json.dogrulama.neden }) }}' }],
    }, [['wh', 0, 'vd', 0], ['vd', 0, 'ok', 0], ['vd', 1, 'no', 0]]),

    musteriTemizle: () => build('Müşteri listesini temizle → Excel', 'İnternetsiz çalışır. Tekrarlanan kişileri siler, e-posta ve telefonları doğrulayıp düzgün biçime çevirir, temiz listeyi musteriler-temiz.xlsx dosyasına, hatalıları hatali-kayitlar.csv dosyasına yazar. "Başlat" node\'undaki örnek veriyi kendi listenizle değiştirin ya da Dosya oku ile Excel\'den okuyun.', {
      tr: ['manual', 0, 160, 'Müşteri listesi', { data: CUSTOMERS }],
      dd: ['dedupe', 280, 160, 'Tekrarları kaldır', { fields: 'eposta' }],
      ep: ['validate', 560, 160, 'E-posta doğru mu?', { kind: 'email', value: '{{ $json.eposta }}', output: 'epostaKontrol', replace: 'eposta' }],
      tl: ['validate', 840, 80, 'Telefon doğru mu?', { kind: 'phone', value: '{{ $json.telefon }}', output: 'telefonKontrol', replace: 'telefon' }],
      st: ['sort', 1120, 0, 'Ada göre sırala', { field: 'ad', order: 'asc' }],
      xl: ['writeFile', 1400, 0, 'Temiz liste (Excel)', { path: 'musteriler-temiz.xlsx', format: 'xlsx', sheet: 'Müşteriler' }],
      mg: ['merge', 1120, 260, 'Hatalıları topla', { mode: 'append' }],
      cs: ['writeFile', 1400, 260, 'Hatalı kayıtlar (CSV)', { path: 'hatali-kayitlar.csv', format: 'csv' }],
    }, [['tr', 0, 'dd', 0], ['dd', 0, 'ep', 0], ['ep', 0, 'tl', 0], ['ep', 1, 'mg', 1], ['tl', 0, 'st', 0], ['st', 0, 'xl', 0], ['tl', 1, 'mg', 0], ['mg', 0, 'cs', 0]]),

    qrEtiket: () => build('Ürün etiketi: QR kodlu PDF', 'İnternetsiz çalışır. Her ürün için sayfa bağlantısının QR kodunu üretir ve adı, fiyatı ve QR kodu olan PDF etiket hazırlar (dosyalar/etiketler klasörü). Raf etiketi, masa menüsü ve kargo içi kart için.', {
      tr: ['manual', 0, 100, 'Ürünler', { data: PRODUCTS }],
      qr: ['qrcode', 300, 100, 'QR kod', { text: '{{ $json.link }}', format: 'png', level: 'Q', scale: 8, file: 'etiketler/{{ $json.kod }}.png' }],
      pdf: ['pdfCreate', 600, 100, 'Etiket PDF\'i', { mode: 'each', title: '{{ $json.ad }}', content: '## {{ $json.fiyat.toFixed(2) }} TL\n\nÜrün kodu: {{ $json.kod }}\n\nAyrıntılar için QR kodu okutun.', image: '{{ $json.qr.dosya }}', imageWidth: 160, imageAlign: 'center', pageSize: 'A4', file: 'etiketler/{{ $json.kod }}.pdf' }],
    }, [['tr', 0, 'qr', 0], ['qr', 0, 'pdf', 0]]),

    teslimTarihi: () => build('Tahmini teslim tarihi (iş günü)', 'İnternetsiz çalışır. Sipariş tarihine resmî tatilleri ve hafta sonlarını atlayarak 3 iş günü ekler ve "tahmini teslim" tarihini JSON olarak döner. Mağaza sayfası ya da kargo e-postası için.', {
      wh: ['webhook', 0, 100, 'Sipariş tarihi', { method: 'POST', path: 'teslim', respond: 'node', sample: '{\n  "siparisTarihi": "2026-10-28"\n}' }],
      bd: ['businessDay', 300, 100, '3 iş günü ekle', { op: 'add', date: '{{ $json.body.siparisTarihi || $today }}', days: 3, output: 'teslim' }],
      st: ['set', 600, 100, 'Mesajı hazırla', { fields: [{ key: 'mesaj', value: 'Siparişiniz en geç {{ $dt.format($json.teslim, "DD.MM.YYYY") }} tarihinde teslim edilir.' }], keep: true }],
      rs: ['respond', 900, 100, 'Sonucu dön', { type: 'json', body: '{{ JSON.stringify({ teslim: $json.teslim, mesaj: $json.mesaj }) }}' }],
    }, [['wh', 0, 'bd', 0], ['bd', 0, 'st', 0], ['st', 0, 'rs', 0]]),

    mcpSiparis: () => build('Claude için sipariş sorgulama aracı (MCP)', 'Claude Desktop ya da Claude Code\'a "siparis_durumu" aracını verir: Claude sipariş numarasıyla sorduğunda "Siparişler" veri tablosundan kaydı bulup döner. Ayarlar → MCP bölümündeki adresi Claude\'a ekleyin. İnternet ve hesap gerekmez.', {
      mc: ['mcpTrigger', 0, 100, 'siparis_durumu aracı', { path: 'magaza', tool: 'siparis_durumu', description: 'Sipariş numarasına göre siparişin durumunu, tutarını ve müşterisini getirir.', inputs: [{ key: 'siparisNo', value: 'Sipariş numarası, örneğin SP-1041' }], result: 'all' }],
      tb: ['table', 320, 100, 'Siparişlerde ara', { table: 'Siparişler', op: 'find', where: [{ key: 'siparisNo', value: '{{ $json.siparisNo }}' }], limit: 5 }],
    }, [['mc', 0, 'tb', 0]]),

    /* ---------- office and team ---------- */
    izinOnay: () => build('İzin talebi → yönetici onayı', 'Çalışan formdan izin ister; yöneticiye onay bağlantılı e-posta gider, akış karar gelene kadar bekler. Onaylanırsa izin "İzinler" tablosuna yazılır ve çalışana bildirilir, reddedilirse nedeniyle birlikte haber verilir. Yalnızca e-posta (SMTP) bilgisi gerekir.', {
      fm: ['form', 0, 160, 'İzin formu', { path: 'izin', title: 'İzin talebi', fields: [{ label: 'Adınız', name: 'ad', type: 'text', required: true }, { label: 'E-posta', name: 'eposta', type: 'email', required: true }, { label: 'Başlangıç', name: 'baslangic', type: 'date', required: true }, { label: 'Bitiş', name: 'bitis', type: 'date', required: true }, { label: 'Açıklama', name: 'neden', type: 'textarea', required: false }], thanks: 'Talebiniz yöneticinize iletildi.' }],
      ym: ['email', 300, 160, 'Yöneticiye sor', { to: 'yonetici@ornek.com', subject: 'İzin talebi: {{ $json.ad }}', body: '{{ $json.ad }}, {{ $json.baslangic }} - {{ $json.bitis }} arası izin istiyor.\n\nAçıklama: {{ $json.neden }}\n\nOnaylamak ya da reddetmek için: {{ $execution.onayAdresi }}' }],
      on: ['approval', 600, 160, 'Yönetici kararı', { message: '{{ $node["İzin formu"].json.ad }}: {{ $node["İzin formu"].json.baslangic }} - {{ $node["İzin formu"].json.bitis }} izni onaylansın mı?', amount: 3, unit: 'd' }],
      tb: ['table', 900, 60, 'İzinler tablosu', { table: 'İzinler', op: 'insert', dataMode: 'fields', fields: [{ key: 'ad', value: '{{ $node["İzin formu"].json.ad }}' }, { key: 'baslangic', value: '{{ $node["İzin formu"].json.baslangic }}' }, { key: 'bitis', value: '{{ $node["İzin formu"].json.bitis }}' }, { key: 'onayNotu', value: '{{ $json.onay.not }}' }] }],
      ev: ['email', 1200, 60, 'Onaylandı e-postası', { to: '{{ $node["İzin formu"].json.eposta }}', subject: 'İzniniz onaylandı', body: 'Merhaba {{ $node["İzin formu"].json.ad }},\n\n{{ $node["İzin formu"].json.baslangic }} - {{ $node["İzin formu"].json.bitis }} izniniz onaylandı. İyi tatiller!' }],
      ha: ['email', 900, 280, 'Reddedildi e-postası', { to: '{{ $node["İzin formu"].json.eposta }}', subject: 'İzin talebiniz hakkında', body: 'Merhaba {{ $node["İzin formu"].json.ad }},\n\nİzin talebiniz bu kez onaylanmadı ({{ $json.onay.karar }}). {{ $json.onay.not }}' }],
    }, [['fm', 0, 'ym', 0], ['ym', 0, 'on', 0], ['on', 0, 'tb', 0], ['tb', 0, 'ev', 0], ['on', 1, 'ha', 0]]),

    randevu: () => build('Randevu formu → takvim davetli e-posta', 'Müşteri formdan gün ve saat seçer; akış .ics takvim daveti hazırlar, davetiyi e-postayla gönderir ve randevuyu "Randevular" tablosuna yazar. Davet Outlook, Gmail ve iPhone takvimine tek tıkla eklenir. E-posta (SMTP) bilgisi gerekir.', {
      fm: ['form', 0, 100, 'Randevu formu', { path: 'randevu', title: 'Randevu alın', fields: [{ label: 'Adınız', name: 'ad', type: 'text', required: true }, { label: 'E-posta', name: 'eposta', type: 'email', required: true }, { label: 'Gün', name: 'gun', type: 'date', required: true }, { label: 'Saat (ör. 14:30)', name: 'saat', type: 'text', required: true }, { label: 'Konu', name: 'konu', type: 'textarea', required: false }], thanks: 'Randevunuz alındı, takvim davetiniz e-postanıza geliyor.' }],
      ic: ['ics', 300, 100, 'Takvim daveti', { title: 'Randevu: {{ $json.ad }}', start: '{{ $json.gun }} {{ $json.saat }}', duration: 30, location: 'Ofisimiz', description: '{{ $json.konu }}', attendees: '{{ $json.eposta }}', reminder: 60 }],
      ml: ['email', 600, 40, 'Daveti gönder', { to: '{{ $json.eposta }}', subject: 'Randevunuz: {{ $json.gun }} {{ $json.saat }}', body: 'Merhaba {{ $json.ad }},\n\nRandevunuz oluşturuldu. Ekteki daveti açarak takviminize ekleyebilirsiniz.\n\nGörüşmek üzere!', attach: '{{ $json.takvim.dosya }}' }],
      tb: ['table', 600, 200, 'Randevular tablosu', { table: 'Randevular', op: 'insert', dataMode: 'fields', fields: [{ key: 'ad', value: '{{ $json.ad }}' }, { key: 'eposta', value: '{{ $json.eposta }}' }, { key: 'zaman', value: '{{ $json.takvim.baslangic }}' }, { key: 'konu', value: '{{ $json.konu }}' }] }],
    }, [['fm', 0, 'ic', 0], ['ic', 0, 'ml', 0], ['ic', 0, 'tb', 0]]),

    gunlukTakvim: () => build('Günün toplantıları → Telegram', 'Hafta içi her sabah 08:00\'de Google Takvim\'deki bugünkü etkinlikleri alır ve saatleriyle tek mesajda Telegram\'a yollar. Google hesabı ve Telegram botu gerekir.', {
      sc: ['schedule', 0, 100, 'Hafta içi 08:00', { mode: 'cron', cron: '0 8 * * 1-5' }],
      cl: ['calendar', 300, 100, 'Bugünkü etkinlikler', { op: 'list', days: 1 }],
      tp: ['aggregate', 600, 100, 'Tek listede topla', { mode: 'all', output: 'etkinlikler' }],
      tg: ['telegram', 900, 100, 'Telegram\'a gönder', { text: '📅 Bugün {{ $json.etkinlikler.length }} etkinlik var:\n\n{{ $json.etkinlikler.map(e => (e.tumGun ? "Tüm gün" : $dt.format(e.baslangic, "HH:mm")) + " · " + e.baslik).join("\\n") }}' }],
    }, [['sc', 0, 'cl', 0], ['cl', 0, 'tp', 0], ['tp', 0, 'tg', 0]]),

    telegramGorev: () => build('Telegram\'dan Todoist\'e görev ekle', 'Telegram botunuza yazdığınız her mesaj Todoist\'e görev olarak eklenir ("yarın", "cuma 15:00" gibi tarihleri Todoist anlar) ve bot "eklendi" diye cevap verir. Telegram botu ve Todoist bilgisi gerekir.', {
      tg: ['telegramTrigger', 0, 100, 'Telegram mesajı', {}],
      td: ['todoist', 300, 100, 'Görev ekle', { op: 'create', content: '{{ $json.mesaj }}', due: '' }],
      yn: ['telegram', 600, 100, 'Eklendi de', { chatId: '{{ $node["Telegram mesajı"].json.sohbetId }}', text: '✅ Görev eklendi: {{ $node["Telegram mesajı"].json.mesaj }}' }],
    }, [['tg', 0, 'td', 0], ['td', 0, 'yn', 0]]),

    jiraHaftalik: () => build('Haftalık iş özeti (Jira → Claude → Slack)', 'Her cuma 17:00\'de son 7 günde kapanan Jira kayıtlarını alır, Claude ile kısa bir haftalık özet yazdırır ve Slack kanalına gönderir. Jira, Anthropic ve Slack bilgileri gerekir.', {
      sc: ['schedule', 0, 100, 'Cuma 17:00', { mode: 'cron', cron: '0 17 * * 5' }],
      ji: ['jira', 300, 100, 'Kapanan kayıtlar', { op: 'search', jql: 'resolved >= -7d ORDER BY resolved DESC', max: 50 }],
      tp: ['aggregate', 600, 100, 'Tek listede topla', { mode: 'all', output: 'kayitlar' }],
      ai: ['claude', 900, 100, 'Özet yaz', { prompt: 'Aşağıdaki bu hafta kapanan iş kayıtlarından ekibe Türkçe, kısa ve madde madde bir haftalık özet yaz. Önemli olanları öne çıkar, en sonda toplam sayıyı belirt.\n\n{{ JSON.stringify($json.kayitlar) }}', effort: 'low' }],
      sl: ['slack', 1200, 100, '#ekip kanalına yaz', { op: 'send', channel: '#ekip', text: ':calendar: *Haftalık özet*\n{{ $json.yanit }}' }],
    }, [['sc', 0, 'ji', 0], ['ji', 0, 'tp', 0], ['tp', 0, 'ai', 0], ['ai', 0, 'sl', 0]]),

    klasorFatura: () => build('Klasöre düşen faturaları oku → tablo', '"dosyalar/faturalar" klasörüne bir PDF ya da fotoğraf fatura bırakınca Claude okur; firma, tutar ve tarihi "Faturalar" tablosuna yazar ve telefonunuza bildirim gönderir. Anthropic API anahtarı ve ntfy konusu gerekir.', {
      ft: ['fileTrigger', 0, 100, 'Yeni fatura dosyası', { folder: 'faturalar', events: 'add', every: 10, unit: 's' }],
      ex: ['extract', 300, 100, 'Faturayı oku', { source: 'file', file: '{{ $json.dosya }}', fields: [{ key: 'firma', value: 'Faturayı kesen firma' }, { key: 'faturaNo', value: 'Fatura numarası' }, { key: 'tarih:tarih', value: 'Fatura tarihi' }, { key: 'tutar:sayı', value: 'KDV dahil toplam' }] }],
      tb: ['table', 600, 100, 'Faturalar tablosu', { table: 'Faturalar', op: 'upsert', key: 'faturaNo', dataMode: 'item' }],
      bi: ['push', 900, 100, 'Bana bildir', { service: 'ntfy', title: 'Fatura kaydedildi', message: '{{ $json.firma }} · {{ $json.tutar }} TL · {{ $json.ad }}' }],
    }, [['ft', 0, 'ex', 0], ['ex', 0, 'tb', 0], ['tb', 0, 'bi', 0]]),

    /* ---------- money and shop ---------- */
    kurAlarm: () => build('Döviz kuru alarmı', 'Hafta içi her gün 10:30\'da TCMB\'den dolar ve euro kurunu alır; dolar belirlediğiniz sınırı geçerse telefonunuza anlık bildirim, her gün de kur özetini Telegram\'a yollar. Kur için anahtar gerekmez; ntfy konusu ve Telegram botu gerekir.', {
      sc: ['schedule', 0, 160, 'Hafta içi 10:30', { mode: 'cron', cron: '30 10 * * 1-5' }],
      kr: ['exchangeRate', 300, 160, 'TCMB kurları', { op: 'rates', codes: 'USD, EUR', kind: 'dovizSatis' }],
      tp: ['aggregate', 600, 160, 'Tek öğede topla', { mode: 'all', output: 'kurlar' }],
      st: ['set', 900, 160, 'Kurları ayır', { fields: [{ key: 'usd', value: '{{ $json.kurlar.find(k => k.kod === "USD").dovizSatis }}' }, { key: 'eur', value: '{{ $json.kurlar.find(k => k.kod === "EUR").dovizSatis }}' }, { key: 'sinir', value: '45' }, { key: 'tarih', value: '{{ $json.kurlar[0].tarih }}' }], keep: false }],
      tg: ['telegram', 1200, 60, 'Günlük kur özeti', { text: '💱 TCMB {{ $json.tarih }}\nDolar: {{ $json.usd }} TL\nEuro: {{ $json.eur }} TL' }],
      ec: ['if', 1200, 260, 'Dolar sınırı geçti mi?', { conditions: [{ left: '{{ $json.usd }}', op: 'gt', right: '{{ $json.sinir }}' }] }],
      bi: ['push', 1500, 260, 'Alarm', { service: 'ntfy', title: 'Dolar {{ $json.sinir }} TL\'yi geçti', message: 'TCMB döviz satış: {{ $json.usd }} TL', priority: '5' }],
    }, [['sc', 0, 'kr', 0], ['kr', 0, 'tp', 0], ['tp', 0, 'st', 0], ['st', 0, 'tg', 0], ['st', 0, 'ec', 0], ['ec', 0, 'bi', 0]]),

    stokAz: () => build('Stoğu azalan ürünler → Telegram', 'Her sabah 09:00\'da WooCommerce mağazanızdaki ürünlerden stoğu 5\'in altına düşenleri bulur ve listeyi Telegram\'a yollar; hepsi yeterliyse mesaj atmaz. WooCommerce ve Telegram bilgileri gerekir.', {
      sc: ['schedule', 0, 100, 'Her sabah 09:00', { mode: 'cron', cron: '0 9 * * *' }],
      wc: ['woocommerce', 300, 100, 'Ürünleri al', { op: 'products', max: 100 }],
      fl: ['filter', 600, 100, 'Stoğu 5\'ten az', { conditions: [{ left: '{{ $json.stok }}', op: 'lt', right: '5' }, { left: '{{ $json.stok }}', op: 'notEmpty', right: '' }], combinator: 'and' }],
      tp: ['aggregate', 900, 100, 'Listeyi topla', { mode: 'all', output: 'urunler' }],
      tg: ['telegram', 1200, 100, 'Telegram\'a gönder', { text: '📦 Stoğu azalan {{ $json.urunler.length }} ürün:\n\n{{ $json.urunler.map(u => "• " + u.ad + " (" + u.sku + "): " + u.stok).join("\\n") }}' }],
    }, [['sc', 0, 'wc', 0], ['wc', 0, 'fl', 0], ['fl', 0, 'tp', 0], ['tp', 0, 'tg', 0]]),

    wooFatura: () => build('WooCommerce siparişi → PDF fatura → e-posta', 'WooCommerce\'e yeni sipariş gelince ürün tablolu PDF sipariş özeti / proforma fatura hazırlar ve müşteriye e-postayla gönderir. WooCommerce ve e-posta (SMTP) bilgileri gerekir.', {
      wc: ['wooTrigger', 0, 100, 'Yeni sipariş', { every: 2, unit: 'm' }],
      pdf: ['pdfCreate', 300, 100, 'Fatura PDF\'i', { mode: 'each', title: 'Sipariş #{{ $json.no }}', content: 'Sayın {{ $json.musteri }},\n\nSiparişiniz için teşekkür ederiz. Sipariş ayrıntıları aşağıdadır.', tableField: '{{ $json.urunler }}', columns: 'ad:Ürün, adet:Adet, tutar:Tutar ({{ $json.paraBirimi }})', total: 'Toplam: {{ $json.tutar }} {{ $json.paraBirimi }}', footer: 'Bu belge bilgi amaçlıdır.', file: 'faturalar/siparis-{{ $json.no }}.pdf' }],
      ml: ['email', 600, 100, 'Müşteriye gönder', { to: '{{ $json.eposta }}', subject: 'Siparişiniz alındı (#{{ $json.no }})', body: 'Merhaba {{ $json.musteri }},\n\n#{{ $json.no }} numaralı siparişiniz alındı. Sipariş özetiniz ektedir.\n\nTeşekkürler!', attach: '{{ $json.pdf.dosya }}' }],
    }, [['wc', 0, 'pdf', 0], ['pdf', 0, 'ml', 0]]),

    iadeOnay: () => build('İade talebi → onay → Stripe iadesi', 'Webhook\'a gelen iade talebini Telegram\'dan size sorar; onaylarsanız Stripe\'ta iadeyi yapar ve müşteriye e-posta atar, reddederseniz nedenini müşteriye bildirir. Stripe, Telegram ve e-posta bilgileri gerekir.', {
      wh: ['webhook', 0, 160, 'İade talebi', { method: 'POST', path: 'iade', respond: 'immediately', sample: '{\n  "odemeId": "pi_123",\n  "ad": "Ayşe",\n  "eposta": "ayse@ornek.com",\n  "tutar": 250,\n  "neden": "Ürün hasarlı geldi"\n}' }],
      tg: ['telegram', 300, 160, 'Bana sor', { text: '↩️ İade talebi: {{ $json.body.ad }} · {{ $json.body.tutar }} TL\nNeden: {{ $json.body.neden }}\n\nKarar ver: {{ $execution.onayAdresi }}' }],
      on: ['approval', 600, 160, 'Karar', { message: '{{ $node["İade talebi"].json.body.ad }} adlı müşterinin {{ $node["İade talebi"].json.body.tutar }} TL iadesi onaylansın mı?', amount: 2, unit: 'd' }],
      st: ['stripe', 900, 60, 'Stripe iadesi', { op: 'refund', paymentId: '{{ $node["İade talebi"].json.body.odemeId }}', amount: '{{ $node["İade talebi"].json.body.tutar }}' }],
      ev: ['email', 1200, 60, 'İade yapıldı e-postası', { to: '{{ $node["İade talebi"].json.body.eposta }}', subject: 'İadeniz yapıldı', body: 'Merhaba {{ $node["İade talebi"].json.body.ad }},\n\n{{ $node["İade talebi"].json.body.tutar }} TL iadeniz kartınıza gönderildi. Bankanıza göre birkaç gün içinde hesabınıza geçer.' }],
      ha: ['email', 900, 280, 'Red e-postası', { to: '{{ $node["İade talebi"].json.body.eposta }}', subject: 'İade talebiniz hakkında', body: 'Merhaba {{ $node["İade talebi"].json.body.ad }},\n\nİade talebinizi inceledik ancak bu kez onaylayamadık. {{ $json.onay.not }}' }],
    }, [['wh', 0, 'tg', 0], ['tg', 0, 'on', 0], ['on', 0, 'st', 0], ['st', 0, 'ev', 0], ['on', 1, 'ha', 0]]),

    /* ---------- marketing and sales ---------- */
    leadSkor: () => build('Gelen müşteri adayını puanla → HubSpot / Mailchimp', 'Web sitenizden gelen müşteri adayını Claude 0-100 arası puanlar. Sıcak adaylar (70+) HubSpot\'a eklenir ve Slack\'e haber verilir, diğerleri Mailchimp bülten listesine "isitilacak" etiketiyle eklenir. Anthropic, HubSpot, Slack ve Mailchimp bilgileri gerekir.', {
      wh: ['webhook', 0, 160, 'Aday geldi', { method: 'POST', path: 'aday', respond: 'immediately', sample: '{\n  "ad": "Ayşe",\n  "soyad": "Yılmaz",\n  "eposta": "ayse@firma.com",\n  "sirket": "Firma A.Ş.",\n  "mesaj": "50 kişilik ekibimiz için yıllık lisans fiyatı alabilir miyim?"\n}' }],
      ai: ['claude', 300, 160, 'Adayı puanla', { prompt: 'Aşağıdaki müşteri adayını satın alma niyeti ve büyüklüğüne göre 0-100 arası puanla. Yalnızca şu JSON\'u döndür: {"puan": 0, "neden": "kısa açıklama"}\n\nŞirket: {{ $json.body.sirket }}\nMesaj: {{ $json.body.mesaj }}', json: true, effort: 'low', model: 'claude-haiku-5-5' }],
      ec: ['if', 600, 160, 'Sıcak aday mı?', { conditions: [{ left: '{{ $json.yanit.puan }}', op: 'gte', right: '70' }] }],
      hs: ['hubspot', 900, 60, 'HubSpot\'a ekle', { op: 'upsert', email: '{{ $node["Aday geldi"].json.body.eposta }}', firstname: '{{ $node["Aday geldi"].json.body.ad }}', lastname: '{{ $node["Aday geldi"].json.body.soyad }}', company: '{{ $node["Aday geldi"].json.body.sirket }}' }],
      sl: ['slack', 1200, 60, 'Satış kanalına yaz', { op: 'send', channel: '#satis', text: ':fire: Sıcak aday ({{ $node["Adayı puanla"].json.yanit.puan }}/100): {{ $node["Aday geldi"].json.body.ad }} - {{ $node["Aday geldi"].json.body.sirket }}\n{{ $node["Adayı puanla"].json.yanit.neden }}' }],
      mc: ['mailchimp', 900, 260, 'Bültene ekle', { op: 'upsert', email: '{{ $node["Aday geldi"].json.body.eposta }}', fname: '{{ $node["Aday geldi"].json.body.ad }}', lname: '{{ $node["Aday geldi"].json.body.soyad }}', tags: 'isitilacak' }],
    }, [['wh', 0, 'ai', 0], ['ai', 0, 'ec', 0], ['ec', 0, 'hs', 0], ['hs', 0, 'sl', 0], ['ec', 1, 'mc', 0]]),

    bulten: () => build('Bülten kayıt formu → Mailchimp', 'Hazır web formundan bültene kaydolan kişinin e-postasını doğrular, Mailchimp listesine ekler ve hatalı adresleri "Hatalı kayıtlar" tablosuna yazar. Mailchimp bilgisi gerekir.', {
      fm: ['form', 0, 100, 'Bülten formu', { path: 'bulten', title: 'Bültenimize katılın', description: 'Kampanya ve yeniliklerden ilk siz haberdar olun.', fields: [{ label: 'Adınız', name: 'ad', type: 'text', required: false }, { label: 'E-posta', name: 'eposta', type: 'email', required: true }], thanks: 'Teşekkürler! Onay e-postası gönderdik.' }],
      vd: ['validate', 300, 100, 'E-posta doğru mu?', { kind: 'email', value: '{{ $json.eposta }}', replace: 'eposta' }],
      mc: ['mailchimp', 600, 20, 'Listeye ekle', { op: 'upsert', email: '{{ $json.eposta }}', fname: '{{ $json.ad }}', status: 'pending', tags: 'web-formu' }],
      tb: ['table', 600, 200, 'Hatalı kayıtlar', { table: 'Hatalı kayıtlar', op: 'insert', dataMode: 'item' }],
    }, [['fm', 0, 'vd', 0], ['vd', 0, 'mc', 0], ['vd', 1, 'tb', 0]]),

    rssSlack: () => build('Blog / RSS yazıları → Claude özeti → Slack', 'Takip ettiğiniz bir blog ya da haber sitesinde yeni yazı çıkınca Claude tek cümlelik Türkçe özet çıkarır ve bağlantısıyla Slack kanalına paylaşır. Anthropic ve Slack bilgileri gerekir.', {
      rs: ['rssTrigger', 0, 100, 'Yeni yazı', { url: 'https://www.ntv.com.tr/teknoloji.rss', every: 15, unit: 'm' }],
      ai: ['aiText', 300, 100, 'Tek cümlede özetle', { op: 'summarize', length: 'oneline', text: '{{ $json.baslik }}\n\n{{ $json.ozet }}', output: 'kisaOzet', model: 'claude-haiku-5-5', effort: 'low' }],
      sl: ['slack', 600, 100, 'Slack\'e paylaş', { op: 'send', channel: '#okuma-listesi', text: ':newspaper: *{{ $json.baslik }}*\n{{ $json.kisaOzet }}\n{{ $json.link }}' }],
    }, [['rs', 0, 'ai', 0], ['ai', 0, 'sl', 0]]),

    ytYorum: () => build('YouTube yorumlarına Claude ile yanıt', 'Kanalınızdaki yeni yorumları Claude okur; olumsuz olanları size Telegram\'dan iletir, diğerlerine samimi bir teşekkür yanıtı yazıp YouTube\'da cevaplar. YouTube (Google), Anthropic ve Telegram bilgileri gerekir.', {
      yt: ['youtubeTrigger', 0, 160, 'Yeni yorum', { event: 'comment', every: 15, unit: 'm' }],
      du: ['aiText', 300, 160, 'Duygu analizi', { op: 'sentiment', text: '{{ $json.metin }}', output: 'duygu', model: 'claude-haiku-5-5', effort: 'low' }],
      ec: ['if', 600, 160, 'Olumsuz mu?', { conditions: [{ left: '{{ $json.duyguPuan }}', op: 'lt', right: '-0.3' }] }],
      tg: ['telegram', 900, 60, 'Bana ilet', { text: '⚠️ Olumsuz YouTube yorumu ({{ $json.yazar }}):\n{{ $json.metin }}' }],
      ya: ['aiText', 900, 260, 'Yanıt yaz', { op: 'reply', tone: 'samimi ve sıcak', text: '{{ $json.metin }}', context: 'Kanal sahibi olarak, kısa ve içten yanıt ver. Emoji kullanabilirsin.', output: 'yanit', model: 'claude-haiku-5-5', effort: 'low' }],
      yy: ['youtube', 1200, 260, 'YouTube\'da yanıtla', { op: 'reply', commentId: '{{ $json.yorumId }}', text: '{{ $json.yanit }}' }],
    }, [['yt', 0, 'du', 0], ['du', 0, 'ec', 0], ['ec', 0, 'tg', 0], ['ec', 1, 'ya', 0], ['ya', 0, 'yy', 0]]),

    gaRapor: () => build('Günlük site trafiği raporu (Analytics → Claude)', 'Her sabah 09:00\'da Google Analytics\'ten dünkü ziyaretçi, oturum ve en çok gezilen sayfaları alır; Claude kısa bir yorum yazar ve e-postayla gönderir. Google hesabı, Anthropic ve e-posta bilgileri gerekir.', {
      sc: ['schedule', 0, 100, 'Her sabah 09:00', { mode: 'cron', cron: '0 9 * * *' }],
      ga: ['googleAnalytics', 300, 100, 'Dünkü rapor', { op: 'report', dates: 'yesterday', dimensions: 'pagePath', metrics: 'activeUsers, sessions, screenPageViews', max: 10 }],
      tp: ['aggregate', 600, 100, 'Tek listede topla', { mode: 'all', output: 'satirlar' }],
      ai: ['claude', 900, 100, 'Yorumla', { prompt: 'Aşağıda web sitemizin dünkü Google Analytics verisi var (en çok gezilen 10 sayfa). Türkçe, 5 maddeyi geçmeyen kısa bir rapor yaz: toplam kullanıcı, öne çıkan sayfalar ve dikkat çeken bir şey varsa öneri.\n\n{{ JSON.stringify($json.satirlar) }}', effort: 'low' }],
      ml: ['email', 1200, 100, 'E-postayla gönder', { to: 'ben@ornek.com', subject: 'Dünkü site trafiği', body: '{{ $json.yanit }}' }],
    }, [['sc', 0, 'ga', 0], ['ga', 0, 'tp', 0], ['tp', 0, 'ai', 0], ['ai', 0, 'ml', 0]]),

    /* ---------- IT, monitoring ---------- */
    githubEtiket: () => build('GitHub kayıtlarını Claude ile etiketle', 'Depoya yeni kayıt (issue) açılınca Claude hata mı, özellik isteği mi, soru mu olduğuna karar verir ve kayda uygun etiketi ekler. GitHub ve Anthropic bilgileri gerekir; deponuzun adını iki node\'da da yazın.', {
      gh: ['githubTrigger', 0, 160, 'Yeni kayıt', { event: 'issues', every: 5, unit: 'm' }],
      cl: ['classify', 300, 160, 'Ne tür kayıt?', { text: '{{ $json.baslik }}\n\n{{ $json.metin }}', categories: [{ key: 'Hata', value: 'Bir şey çalışmıyor, hata ya da çökme bildiriyor' }, { key: 'Özellik', value: 'Yeni bir özellik ya da iyileştirme istiyor' }, { key: 'Soru', value: 'Nasıl kullanılacağını soruyor' }], other: false, model: 'claude-haiku-5-5', effort: 'low' }],
      e1: ['set', 600, 40, 'bug', { fields: [{ key: 'etiket', value: 'bug' }], keep: true }],
      e2: ['set', 600, 160, 'enhancement', { fields: [{ key: 'etiket', value: 'enhancement' }], keep: true }],
      e3: ['set', 600, 280, 'question', { fields: [{ key: 'etiket', value: 'question' }], keep: true }],
      gu: ['github', 900, 160, 'Etiketi ekle', { op: 'updateIssue', number: '{{ $json.numara }}', labels: '{{ [...$json.etiketler, $json.etiket].join(", ") }}' }],
    }, [['gh', 0, 'cl', 0], ['cl', 0, 'e1', 0], ['cl', 1, 'e2', 0], ['cl', 2, 'e3', 0], ['e1', 0, 'gu', 0], ['e2', 0, 'gu', 0], ['e3', 0, 'gu', 0]]),

    stokGeldi: () => build('Ürün stoğa girince haber ver', 'Her saat başı bir ürün sayfasını açar; sayfada "Sepete ekle" yazısı görünürse (ürün stoğa girdiyse) telefonunuza anlık bildirim gönderir. Aynı gün içinde bir kez haber verir. Yalnızca ntfy konusu gerekir.', {
      sc: ['schedule', 0, 100, 'Her saat', { mode: 'cron', cron: '0 * * * *' }],
      ad: ['set', 280, 100, 'Ürün sayfası', { fields: [{ key: 'link', value: 'https://magaza.com/urun/ornek' }, { key: 'aranan', value: 'Sepete ekle' }], keep: false }],
      wp: ['webPage', 560, 100, 'Sayfayı aç', { url: '{{ $json.link }}', maxChars: 5000, contains: '{{ $json.aranan }}' }],
      ec: ['if', 840, 100, 'Stokta mı?', { conditions: [{ left: '{{ $json.iceriyor }}', op: 'isTrue', right: '' }] }],
      yn: ['newItems', 1120, 40, 'Bugün haber verilmedi mi?', { key: '{{ $json.adres }} {{ $today }}' }],
      bi: ['push', 1400, 40, 'Bana bildir', { service: 'ntfy', title: 'Stoğa girdi: {{ $json.baslik }}', message: '{{ $json.adres }}', url: '{{ $json.adres }}', priority: '4' }],
    }, [['sc', 0, 'ad', 0], ['ad', 0, 'wp', 0], ['wp', 0, 'ec', 0], ['ec', 0, 'yn', 0], ['yn', 0, 'bi', 0]]),

    yagmur: () => build('Yağmur uyarısı → Telegram', 'Her sabah 07:00\'de şehrinizin hava tahminine bakar; yağış ihtimali %60\'ı geçerse "şemsiyeni al" mesajını sıcaklıkla birlikte Telegram\'a yollar. Hava durumu için anahtar gerekmez; Telegram botu gerekir.', {
      sc: ['schedule', 0, 100, 'Her sabah 07:00', { mode: 'cron', cron: '0 7 * * *' }],
      hv: ['weather', 300, 100, 'Hava tahmini', { place: 'İstanbul', days: 1 }],
      ec: ['if', 600, 100, 'Yağmur var mı?', { conditions: [{ left: '{{ $json.gunler[0].yagisIhtimali }}', op: 'gte', right: '60' }] }],
      tg: ['telegram', 900, 40, 'Telegram\'a gönder', { text: '☔ Bugün {{ $json.yer }} için yağış ihtimali %{{ $json.gunler[0].yagisIhtimali }}. Şemsiyeni almayı unutma!\n{{ $json.ozet }}' }],
    }, [['sc', 0, 'hv', 0], ['hv', 0, 'ec', 0], ['ec', 0, 'tg', 0]]),

    dbYedek: () => build('Veritabanı tablosunu her gece Excel\'e yedekle → Drive', 'Her gece 02:00\'de SQL veritabanınızdaki bir tablonun bütün satırlarını tarihli bir Excel dosyasına yazar ve Google Drive\'a yükler. Veritabanı bağlantısı ve Google hesabı gerekir.', {
      sc: ['schedule', 0, 100, 'Her gece 02:00', { mode: 'cron', cron: '0 2 * * *' }],
      db: ['database', 300, 100, 'Satırları al', { op: 'select', table: 'siparisler', limit: 0 }],
      xl: ['writeFile', 600, 100, 'Excel\'e yaz', { path: 'yedekler/siparisler-{{ $today }}.xlsx', format: 'xlsx', sheet: 'Siparişler' }],
      dr: ['drive', 900, 100, 'Drive\'a yükle', { op: 'upload', source: 'file', file: '{{ $json.dosya }}', name: 'siparisler-{{ $today }}.xlsx' }],
    }, [['sc', 0, 'db', 0], ['db', 0, 'xl', 0], ['xl', 0, 'dr', 0]]),
  };

  // cat: gallery category; offline: runs without internet or accounts
  const LIST = [
    { key: 'tcknDogrula', cat: 'Başlangıç', offline: true, title: 'T.C. kimlik no doğrulama API\'si', text: 'Webhook\'a gelen TCKN\'yi kontrol hanesiyle doğrular, JSON döner. İnternetsiz.', flow: ['Webhook', 'Doğrula', 'Yanıt ver'] },
    { key: 'musteriTemizle', cat: 'Başlangıç', offline: true, title: 'Müşteri listesini temizle → Excel', text: 'Tekrarları siler, e-posta ve telefonu doğrular, temiz listeyi Excel\'e, hatalıları CSV\'ye yazar.', flow: ['Manuel', 'Tekrarları kaldır', 'Doğrula', 'Sırala', 'Excel'] },
    { key: 'qrEtiket', cat: 'Başlangıç', offline: true, title: 'Ürün etiketi: QR kodlu PDF', text: 'Her ürün için QR kodlu PDF etiket hazırlar.', flow: ['Manuel', 'QR kod', 'PDF'] },
    { key: 'teslimTarihi', cat: 'E-ticaret', offline: true, title: 'Tahmini teslim tarihi (iş günü)', text: 'Tatilleri ve hafta sonunu atlayarak teslim tarihini hesaplar.', flow: ['Webhook', 'İş günü', 'Ayarla', 'Yanıt ver'] },
    { key: 'mcpSiparis', cat: 'Yapay zekâ', offline: true, title: 'Claude için sipariş sorgulama aracı (MCP)', text: 'Claude Desktop/Code siparişleri veri tablosundan sorgulayabilir.', flow: ['MCP aracı', 'Veri tablosu'] },
    { key: 'izinOnay', cat: 'Ofis ve ekip', title: 'İzin talebi → yönetici onayı', text: 'Form, onay bağlantılı e-posta, karar bekleme, tablo ve bildirim.', flow: ['Form', 'E-posta', 'Onay bekle', 'Veri tablosu', 'E-posta'] },
    { key: 'randevu', cat: 'Ofis ve ekip', title: 'Randevu formu → takvim daveti', text: 'Randevuya .ics davet hazırlar, e-postayla yollar, tabloya yazar.', flow: ['Form', 'Takvim daveti', 'E-posta', 'Veri tablosu'] },
    { key: 'gunlukTakvim', cat: 'Ofis ve ekip', title: 'Günün toplantıları → Telegram', text: 'Her sabah Google Takvim\'deki bugünkü etkinlikleri Telegram\'a yollar.', flow: ['Zamanlayıcı', 'Google Takvim', 'Topla', 'Telegram'] },
    { key: 'telegramGorev', cat: 'Ofis ve ekip', title: 'Telegram\'dan Todoist\'e görev', text: 'Bota yazdığınız mesaj Todoist\'e görev olur.', flow: ['Telegram', 'Todoist', 'Telegram'] },
    { key: 'jiraHaftalik', cat: 'Ofis ve ekip', title: 'Haftalık iş özeti (Jira → Slack)', text: 'Kapanan kayıtları Claude özetler, Slack\'e yazar.', flow: ['Zamanlayıcı', 'Jira', 'Topla', 'Claude', 'Slack'] },
    { key: 'klasorFatura', cat: 'Muhasebe', title: 'Klasöre düşen faturaları oku', text: 'Klasöre bırakılan faturayı Claude okur, tabloya yazar, bildirir.', flow: ['Klasör izleyici', 'Bilgi çıkar', 'Veri tablosu', 'Bildirim'] },
    { key: 'kurAlarm', cat: 'Muhasebe', title: 'Döviz kuru alarmı', text: 'TCMB kurlarını Telegram\'a yollar, dolar sınırı geçince alarm verir.', flow: ['Zamanlayıcı', 'Döviz kuru', 'Topla', 'Eğer', 'Bildirim'] },
    { key: 'stokAz', cat: 'E-ticaret', title: 'Stoğu azalan ürünler → Telegram', text: 'WooCommerce\'te stoğu 5\'in altına düşen ürünleri bildirir.', flow: ['Zamanlayıcı', 'WooCommerce', 'Filtrele', 'Topla', 'Telegram'] },
    { key: 'wooFatura', cat: 'E-ticaret', title: 'WooCommerce siparişi → PDF → e-posta', text: 'Yeni siparişe ürün tablolu PDF hazırlar, müşteriye yollar.', flow: ['WooCommerce', 'PDF', 'E-posta'] },
    { key: 'iadeOnay', cat: 'E-ticaret', title: 'İade talebi → onay → Stripe iadesi', text: 'Telegram\'dan size sorar; onaylarsanız Stripe\'ta iade yapar.', flow: ['Webhook', 'Telegram', 'Onay bekle', 'Stripe', 'E-posta'] },
    { key: 'leadSkor', cat: 'Satış ve pazarlama', title: 'Müşteri adayını puanla → HubSpot', text: 'Claude adayı puanlar; sıcaklar HubSpot ve Slack\'e, diğerleri Mailchimp\'e.', flow: ['Webhook', 'Claude', 'Eğer', 'HubSpot', 'Slack', 'Mailchimp'] },
    { key: 'bulten', cat: 'Satış ve pazarlama', title: 'Bülten kayıt formu → Mailchimp', text: 'E-postayı doğrular, Mailchimp\'e ekler.', flow: ['Form', 'Doğrula', 'Mailchimp', 'Veri tablosu'] },
    { key: 'rssSlack', cat: 'Satış ve pazarlama', title: 'Blog yazıları → Claude özeti → Slack', text: 'Yeni yazıyı tek cümlede özetleyip Slack\'e paylaşır.', flow: ['RSS', 'Claude metin', 'Slack'] },
    { key: 'ytYorum', cat: 'Satış ve pazarlama', title: 'YouTube yorumlarına Claude ile yanıt', text: 'Olumsuzları size iletir, diğerlerine teşekkür yanıtı yazar.', flow: ['YouTube', 'Claude metin', 'Eğer', 'YouTube', 'Telegram'] },
    { key: 'gaRapor', cat: 'Satış ve pazarlama', title: 'Günlük site trafiği raporu', text: 'Analytics verisini Claude yorumlar, e-postayla yollar.', flow: ['Zamanlayıcı', 'Analytics', 'Claude', 'E-posta'] },
    { key: 'githubEtiket', cat: 'BT ve yazılım', title: 'GitHub kayıtlarını Claude ile etiketle', text: 'Yeni issue\'ya hata / özellik / soru etiketi ekler.', flow: ['GitHub', 'Sınıflandır', 'Ayarla', 'GitHub'] },
    { key: 'stokGeldi', cat: 'İzleme ve bildirim', title: 'Ürün stoğa girince haber ver', text: 'Ürün sayfasında "Sepete ekle" görünce bildirim gönderir.', flow: ['Zamanlayıcı', 'Web sayfası', 'Eğer', 'Yeni öğeler', 'Bildirim'] },
    { key: 'yagmur', cat: 'İzleme ve bildirim', title: 'Yağmur uyarısı → Telegram', text: 'Yağış ihtimali yüksekse sabah Telegram\'a mesaj atar.', flow: ['Zamanlayıcı', 'Hava durumu', 'Eğer', 'Telegram'] },
    { key: 'dbYedek', cat: 'BT ve yazılım', title: 'Veritabanı tablosunu Drive\'a yedekle', text: 'Her gece tabloyu Excel\'e yazar, Google Drive\'a yükler.', flow: ['Zamanlayıcı', 'Veritabanı', 'Excel', 'Google Drive'] },
  ];
  return { TEMPLATES, LIST };
};
