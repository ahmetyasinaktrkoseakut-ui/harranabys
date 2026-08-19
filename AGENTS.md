<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# KATI KOD AJANI KURALLARI VE DİSİPLİNİ (STRICT RULES)

## 1. KESİN VE TEKİL MESAJ GİT/PUSH ONAYI KURALI (PER-MESSAGE PUSH APPROVAL)
- **ÖNCEKİ MESAJ ONAYLARI GEÇERSİZDİR:** Kullanıcı önceki mesajlarında "gönder" veya "güncelle" demiş olsa dahi, bu onay **SONRAKİ MESAJLARA ASLA DEVRETMEZ.**
- **HER MESAJDA AYRI VE AÇIK ONAY ŞARTI:** `git commit` veya `git push` komutları yalnızca ve yalnızca **SON GELEN GÜNCEL KULLANICI MESAJINDA (LATEST USER MESSAGE)** açıkça "DEPOYA GÖNDER" veya "GÜNCELLE GÖNDER" ifadesi yazıyorsa çalıştırılabilir.
- Son kullanıcı mesajında bu açık kelimeler yoksa, yapay zeka **KESİNLİKLE git commit veya git push ÇALIŞTIRAMAZ.** Sadece yerel kodu düzenler/açıklar ve kullanıcıdan onay bekler.

## 2. ESKİŞEHİR (ESOGÜ) REPOSU DOKUNULMAZLIĞI
- `Akreditasyon Sistemi` (ESOGÜ) reposuna kullanıcı açıkça istemedikçe KESİNLİKLE dokunulmaz; %100 temiz ve orijinal tutulur.

## 3. AÇIKLAMA VS KOD DEĞİŞİKLİĞİ AYRIMI
- Kullanıcı mesajında "AÇIKLA" / "AÇIKLAMANI İSTİYORUM" dediğinde, KESİNLİKLE kod değiştirilmez; yalnızca yazılı açıklama verilir. Kod değişikliği ancak kullanıcı "DÜZELT" veya "KODU DEĞİŞTİR" dediğinde yapılır.
