# 🚀 Urfa İlahiyat Fakültesi - ABYS Kurulum Rehberi

Bu klasör, Eskişehir Osmangazi Üniversitesi İlahiyat Fakültesi Akreditasyon Bilgi Yönetim Sistemi'nin **tüm sistem mimarisini, RLS güvenlik kurallarını, 5 ana başlık ve 59 alt ölçütün Türkçe/İngilizce Kalite El Kitabı metinlerini** eksiksiz barındıran, ancak **hiçbir hoca veya rapor verisi içermeyen** sıfır verili temiz yedek projesidir.

Sistemi yeni bir kurum için (örneğin Urfa İlahiyat Fakültesi) sıfırdan kurup çalıştırmak için **3 basit adımı** izlemeniz yeterlidir:

---

### 1. ADIM: Supabase Veritabanını Tek Tıkla Kurma
1. `supabase.com` adresine girip Urfa İlahiyat Fakültesi için **yeni bir proje** açın.
2. Sol menüdeki **SQL Editor** (`>_`) sekmesine tıklayın ve **"New query"** butonuna basın.
3. Bu klasör içindeki `supabase/urfa_setup_clean.sql` dosyasının **tüm içeriğini kopyalayıp** buraya yapıştırın ve **"Run"** butonuna basın.
   - *Bu işlem; veritabanı tablolarını, rol güvenlik politikalarını (RLS), otomatik profil oluşturma trigger'ını ve 59 alt ölçütün eksiksiz Kalite El Kitabı metinlerini tek seferde sıfır hata ile kuracaktır.*
4. Sol menüdeki **Storage** (📦) sekmesine girip sırasıyla iki adet kova (bucket) oluşturun:
   - Adı **`dokumanlar`** olacak şekilde bir kova oluşturup erişimini **Public** yapın.
   - Adı **`kanit_dosyalari`** olacak şekilde ikinci bir kova oluşturup erişimini **Public** yapın.
   - *(Kanıt yükleme sisteminin sorunsuz çalışması için iki kovanın da herkese açık (Public) olması şarttır.)*

---

### 2. ADIM: Ortam Değişkenlerini Tanımlama (.env.local)
1. Bu projenin ana dizinindeki `.env.local.example` dosyasının adını **`.env.local`** olarak değiştirin.
2. Yeni açtığınız Urfa Supabase projesinin **Settings -> API** sayfasından alacağınız değerleri yapıştırın:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://[URFA_PROJE_ID].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[URFA_ANON_KEY]
   SUPABASE_SERVICE_ROLE_KEY=[URFA_SERVICE_ROLE_KEY]
   ```

---

### 3. ADIM: İlk Yöneticiyi (Admin) Tanımlama
1. Sistemi başlattığınızda (`npm run dev` veya Vercel üzerinde) Urfa İlahiyat yetkilisi olarak sisteme ilk kaydınızı olun.
2. Supabase panelinizden **Table Editor -> profiller** tablosuna girin.
3. Kendi e-postanızın olduğu satırdaki `rol` değerini **`Beklemede`** durumundan **`Yonetici`** olarak değiştirin.

Tebrikler! Sisteminiz Urfa İlahiyat Fakültesi için tamamen kullanıma hazırdır. ⚡
