const fs = require('fs');
const path = require('path');

const trPath = path.join(__dirname, 'messages', 'tr.json');
const enPath = path.join(__dirname, 'messages', 'en.json');
const arPath = path.join(__dirname, 'messages', 'ar.json');

const tr = JSON.parse(fs.readFileSync(trPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

const additionsTR = {
  "KaliteElKitabi": {
    "title": "Kalite El Kitabı Veri Girişi",
    "description_label": "KALİTE EL KİTABI AÇIKLAMASI",
    "description_en_label": "KALİTE EL KİTABI AÇIKLAMASI (İNGİLİZCE)",
    "placeholder": "Bu ölçüte dair detaylı açıklama metnini veya raporu buraya giriniz...",
    "placeholder_en": "Bu ölçüte dair detaylı İngilizce açıklama metnini veya raporu buraya giriniz...",
    "table_title": "Tablo 1.",
    "responsible_unit": "Sorumlu Birim",
    "first_planning_date": "İlk Planlama Tarihi",
    "internal_stakeholders": "İç Paydaşlar",
    "external_stakeholders": "Dış Paydaşlar",
    "international_stakeholders": "Uluslararası Paydaşlar",
    "application_areas": "Uygulama Alanları",
    "tracking_mechanisms": "İzleme Mekanizmaları",
    "performance_indicators": "Performans Göstergeleri",
    "eval_improvement_date": "Değerlendirme ve İyileştirme Tarihi",
    "bgs_location": "Alt Ölçütün BYS'deki Yeri",
    "placeholder_unit": "Birim adını giriniz...",
    "placeholder_internal": "İç paydaşları listeleyiniz...",
    "placeholder_external": "Dış paydaşları listeleyiniz...",
    "placeholder_international": "Uluslararası paydaşları listeleyiniz...",
    "placeholder_areas": "Uygulama alanlarını belirtiniz...",
    "placeholder_tracking": "İzleme süreçlerini açıklayınız...",
    "placeholder_indicators": "Ölçülebilir göstergeleri giriniz...",
    "placeholder_bgs": "BYS üzerindeki konumunu belirtiniz...",
    "save": "KALİTE EL KİTABINI KAYDET",
    "saving": "KAYDEDİLİYOR...",
    "save_success": "Kalite El Kitabı başarıyla kaydedildi.",
    "save_error": "Kaydetme hatası: "
  },
  "KontrolEtme": {
    "evaluation_survey": "Değerlendirme Anketi",
    "question_form": "Soru Formu",
    "general_evaluation": "Kontrol Aşaması Genel Değerlendirmesi",
    "evaluation_placeholder": "Yukarıdaki anket sonuçlarına ve izleme verilerine dayanarak elde ettiğiniz bulguları buraya yazın.",
    "admin_analysis": "Yönetimden Gelen Anket Analizi"
  },
  "QualityManualReport": {
    "title": "Kurumsal Kalite El Kitabı",
    "description": "Sistemdeki tüm kalite el kitabı verilerinin toplu görünümü ve raporlanması.",
    "download_btn": "Raporu Excel Olarak İndir (.xls)",
    "download_excel_btn": "Excel Olarak İndir (.xls)",
    "download_word_btn": "Word Olarak İndir (.doc)",
    "table_prefix": "Tablo 1.",
    "empty_data": "-"
  },
  "Coordinators": {
    "title": "Başlık Koordinatörleri",
    "description": "Bu ekrandan 5 ana başlık için koordinatör ataması yapabilirsiniz. Koordinatörler, kendi başlıkları altındaki ölçütleri birimlere dağıtabilir ve gelen veri girişlerini onaylayıp reddedebilir.",
    "new_assignment": "Yeni Atama Yap",
    "user_search": "KULLANICI ARAMA",
    "search_placeholder": "İsim veya E-posta...",
    "select_user": "Kullanıcı Seçin",
    "select_user_placeholder": "-- Kullanıcı Seç --",
    "assigned_topic": "Sorumlu Olacağı Başlık",
    "select_topic_placeholder": "-- Başlık Seç --",
    "save_assignment": "Atamayı Kaydet",
    "current_coordinators": "Mevcut Koordinatörler",
    "no_coordinators": "Henüz atanmış bir koordinatör yok."
  }
};

const additionsEN = {
  "KaliteElKitabi": {
    "title": "Quality Manual Data Entry",
    "description_label": "QUALITY MANUAL DESCRIPTION",
    "description_en_label": "QUALITY MANUAL DESCRIPTION (ENGLISH)",
    "placeholder": "Enter detailed explanation text or report regarding this criterion here...",
    "placeholder_en": "Enter detailed English explanation text or report regarding this criterion here...",
    "table_title": "Table 1.",
    "responsible_unit": "Responsible Unit",
    "first_planning_date": "First Planning Date",
    "internal_stakeholders": "Internal Stakeholders",
    "external_stakeholders": "External Stakeholders",
    "international_stakeholders": "International Stakeholders",
    "application_areas": "Application Areas",
    "tracking_mechanisms": "Tracking Mechanisms",
    "performance_indicators": "Performance Indicators",
    "eval_improvement_date": "Evaluation and Improvement Date",
    "bgs_location": "Location in IT System",
    "placeholder_unit": "Enter unit name...",
    "placeholder_internal": "List internal stakeholders...",
    "placeholder_external": "List external stakeholders...",
    "placeholder_international": "List international stakeholders...",
    "placeholder_areas": "Specify application areas...",
    "placeholder_tracking": "Explain tracking processes...",
    "placeholder_indicators": "Enter measurable indicators...",
    "placeholder_bgs": "Specify its location on IT System...",
    "save": "SAVE QUALITY MANUAL",
    "saving": "SAVING...",
    "save_success": "Quality Manual successfully saved.",
    "save_error": "Save error: "
  },
  "KontrolEtme": {
    "evaluation_survey": "Evaluation Survey",
    "question_form": "Question Form",
    "general_evaluation": "Checking Phase General Evaluation",
    "evaluation_placeholder": "Write your findings obtained based on the survey results and tracking data above here.",
    "admin_analysis": "Survey Analysis from Management"
  },
  "QualityManualReport": {
    "title": "Institutional Quality Manual",
    "description": "Aggregate view and reporting of all quality manual data in the system.",
    "download_btn": "Download Report as Excel (.xls)",
    "download_excel_btn": "Download as Excel (.xls)",
    "download_word_btn": "Download as Word (.doc)",
    "table_prefix": "Table 1.",
    "empty_data": "-"
  },
  "Coordinators": {
    "title": "Topic Coordinators",
    "description": "You can assign coordinators for the 5 main topics from this screen. Coordinators can distribute criteria under their topics to units and approve/reject incoming data entries.",
    "new_assignment": "Make New Assignment",
    "user_search": "USER SEARCH",
    "search_placeholder": "Name or Email...",
    "select_user": "Select User",
    "select_user_placeholder": "-- Select User --",
    "assigned_topic": "Assigned Topic",
    "select_topic_placeholder": "-- Select Topic --",
    "save_assignment": "Save Assignment",
    "current_coordinators": "Current Coordinators",
    "no_coordinators": "No coordinator assigned yet."
  }
};

const additionsAR = {
  "KaliteElKitabi": {
    "title": "إدخال بيانات دليل الجودة",
    "description_label": "وصف دليل الجودة",
    "description_en_label": "وصف دليل الجودة (باللغة الإنجليزية)",
    "placeholder": "أدخل نص الشرح التفصيلي أو التقرير المتعلق بهذا المعيار هنا...",
    "placeholder_en": "أدخل نص الشرح التفصيلي باللغة الإنجليزية أو التقرير المتعلق بهذا المعيار هنا...",
    "table_title": "الجدول 1.",
    "responsible_unit": "الوحدة المسؤولة",
    "first_planning_date": "تاريخ التخطيط الأول",
    "internal_stakeholders": "أصحاب المصلحة الداخليين",
    "external_stakeholders": "أصحاب المصلحة الخارجيين",
    "international_stakeholders": "أصحاب المصلحة الدوليين",
    "application_areas": "مجالات التطبيق",
    "tracking_mechanisms": "آليات التتبع",
    "performance_indicators": "مؤشرات الأداء",
    "eval_improvement_date": "تاريخ التقييم والتحسين",
    "bgs_location": "الموقع في نظام المعلومات",
    "placeholder_unit": "أدخل اسم الوحدة...",
    "placeholder_internal": "قائمة أصحاب المصلحة الداخليين...",
    "placeholder_external": "قائمة أصحاب المصلحة الخارجيين...",
    "placeholder_international": "قائمة أصحاب المصلحة الدوليين...",
    "placeholder_areas": "حدد مجالات التطبيق...",
    "placeholder_tracking": "اشرح عمليات التتبع...",
    "placeholder_indicators": "أدخل مؤشرات قابلة للقياس...",
    "placeholder_bgs": "حدد موقعه في نظام المعلومات...",
    "save": "حفظ دليل الجودة",
    "saving": "جاري الحفظ...",
    "save_success": "تم حفظ دليل الجودة بنجاح.",
    "save_error": "خطأ في الحفظ: "
  },
  "KontrolEtme": {
    "evaluation_survey": "استبيان التقييم",
    "question_form": "نموذج الأسئلة",
    "general_evaluation": "التقييم العام لمرحلة التحقق",
    "evaluation_placeholder": "اكتب النتائج التي حصلت عليها بناءً على نتائج الاستبيان وبيانات التتبع أعلاه هنا.",
    "admin_analysis": "تحليل الاستبيان من الإدارة"
  },
  "QualityManualReport": {
    "title": "دليل الجودة المؤسسية",
    "description": "عرض وتجميع تقارير جميع بيانات دليل الجودة in the system.",
    "download_btn": "تنزيل التقرير بصيغة إكسل (.xls)",
    "download_excel_btn": "تنزيل بصيغة إكسل (.xls)",
    "download_word_btn": "تنزيل بصيغة وورد (.doc)",
    "table_prefix": "الجدول 1.",
    "empty_data": "-"
  },
  "Coordinators": {
    "title": "منسقو المواضيع",
    "description": "يمكنك تعيين منسقين للمواضيع الرئيسية الخمسة من هذه الشاشة. يمكن للمنسقين توزيع المعايير تحت مواضيعهم على الوحدات والموافقة/رفض إدخالات البيانات الواردة.",
    "new_assignment": "إجراء تعيين جديد",
    "user_search": "بحث عن مستخدم",
    "search_placeholder": "الاسم أو البريد الإلكتروني...",
    "select_user": "اختر مستخدم",
    "select_user_placeholder": "-- اختر مستخدم --",
    "assigned_topic": "الموضوع المعين",
    "select_topic_placeholder": "-- اختر موضوع --",
    "save_assignment": "حفظ التعيين",
    "current_coordinators": "المنسقون الحاليون",
    "no_coordinators": "لم يتم تعيين أي منسق بعد."
  }
};

Object.assign(tr, additionsTR);
Object.assign(en, additionsEN);
Object.assign(ar, additionsAR);

// Extra fixes for missing Phase/Survey strings in TR/EN/AR
['status_pending', 'status_approved', 'status_rejected'].forEach(key => {
  tr.Phase = tr.Phase || {};
  en.Phase = en.Phase || {};
  ar.Phase = ar.Phase || {};
  
  tr.Phase.status_pending = "DURUM: BEKLİYOR";
  tr.Phase.status_approved = "DURUM: ONAYLANDI";
  tr.Phase.status_rejected = "DURUM: REDDEDİLDİ";
  
  en.Phase.status_pending = "STATUS: PENDING";
  en.Phase.status_approved = "STATUS: APPROVED";
  en.Phase.status_rejected = "STATUS: REJECTED";
  
  ar.Phase.status_pending = "الحالة: قيد الانتظار";
  ar.Phase.status_approved = "الحالة: تمت الموافقة";
  ar.Phase.status_rejected = "الحالة: مرفوض";
});

fs.writeFileSync(trPath, JSON.stringify(tr, null, 2));
fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2));
console.log("Translations updated successfully!");
