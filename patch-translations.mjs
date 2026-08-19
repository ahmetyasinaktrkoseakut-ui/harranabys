import fs from 'fs';

const enPath = './messages/en.json';
const arPath = './messages/ar.json';

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

if (en.Assignments && en.Assignments.sidebar) {
  en.Assignments.sidebar.search_no_result = "No results found.";
}
if (ar.Assignments && ar.Assignments.sidebar) {
  ar.Assignments.sidebar.search_no_result = "لم يتم العثور على نتائج.";
}

if (ar.Surveys) {
  ar.Surveys.question_form = "نموذج الأسئلة";
}

ar.PeriodManagement = {
  "title": "إدارة الفترات / السنوات",
  "description": "إدارة الفترات لضمان عمل النظام عبر سنوات متعددة. يتم إجراء الأرشفة والتحضيرات للسنوات الجديدة من هنا.",
  "add_new": "إضافة فترة جديدة",
  "table": {
    "name": "اسم الفترة / السنة",
    "status": "الحالة",
    "actions": "الإجراءات"
  },
  "status": {
    "active": "نشط (إدخال البيانات متاح)",
    "passive": "غير نشط (للقراءة فقط / أرشيف)"
  },
  "modal": {
    "title": "إضافة / تعديل فترة",
    "name_label": "اسم الفترة",
    "name_placeholder": "مثل: 2024، 2024-2025 الخريف، إلخ.",
    "is_active_label": "هل هي نشطة؟",
    "is_active_desc": "يمكن إدخال البيانات وتعديلها في الفترات النشطة. الفترات غير النشطة تكون للقراءة فقط."
  },
  "messages": {
    "save_success": "تم حفظ الفترة بنجاح.",
    "save_error": "حدث خطأ أثناء حفظ الفترة.",
    "delete_confirm": "هل أنت متأكد أنك تريد حذف هذه الفترة؟ لن يتم حذف البيانات المرتبطة بها (مثل PUKÖ، الأدلة، إلخ)، ولكن قد لا يمكن الوصول إليها.",
    "delete_success": "تم حذف الفترة بنجاح.",
    "active_period_required": "يوصى بوجود فترة نشطة واحدة على الأقل في النظام."
  }
};

ar.SelfEvaluation = {
  "title": "تقرير التقييم الذاتي المؤسسي (المرحلة السابعة)",
  "description": "قم بمراجعة واعتماد جميع الأدلة والتفسيرات المجمعة لهذا المعيار في تنسيق تقرير هرمي.",
  "no_data_alert": "لم يتم العثور على إدخال بيانات من المراحل السابقة (التخطيط - التحسين) لهذا المعيار. يرجى إكمال المراحل أولاً.",
  "pull_and_edit": "جلب البيانات من النظام وإنشاء التقرير",
  "pull_desc": "يتم دمج جميع النصوص والأدلة المدخلة في مراحل التخطيط، التنفيذ، المراقبة، والتحسين تلقائيًا.",
  "editor_title": "محرر التقرير",
  "editor_desc": "يمكنك إجراء تعديل نهائي على النص أدناه وتضمين الأدلة قبل تقديمه كتقرير للمؤسسة.",
  "download_word": "تنزيل كملف Word (.doc)",
  "re_pull": "إعادة جلب البيانات",
  "save_report": "حفظ التقرير",
  "saving_report": "جاري الحفظ...",
  "save_success": "تم حفظ التقرير بنجاح.",
  "evidence_list_title": "الأدلة المرفقة",
  "add_new_evidence": "تعريف دليل جديد",
  "evidence_no": "رقم",
  "evidence_name": "اسم الدليل",
  "actions": "الإجراءات",
  "add_to_text": "إضافة إلى النص",
  "no_evidence_uploaded": "لم يتم رفع أي دليل لهذا المعيار بعد.",
  "approve_criterion": "اعتماد المعيار بأكمله",
  "reject_criterion": "رفض المعيار بأكمله",
  "approve_success": "تم اعتماد المعيار بأكمله بنجاح.",
  "reject_success": "تم رفض المعيار وإخطار الموظفين.",
  "reject_desc": "هل أنت متأكد أنك تريد رفض كافة مراحل المعيار وتقريره النهائي؟ يرجى ذكر سبب ليتمكن الموظفون من التصحيح.",
  "reject_reason": "سبب الرفض",
  "confirm_reject": "تأكيد الرفض",
  "close": "إغلاق",
  "cancel": "إلغاء",
  "home": "الصفحة الرئيسية",
  "criteria": "معايير الجودة",
  "synthesis_desc": "تجميع كافة المراحل والتقرير النهائي.",
  "evidences": "الأدلة",
  "no_evidence": "لا توجد أدلة",
  "reject_modal_title": "رفض المعيار بأكمله",
  "reject_placeholder": "دليل مفقود، بيانات غير صحيحة، إلخ.",
  "enter_reject_reason": "يرجى إدخال سبب الرفض.",
  "enter_evidence_name": "أدخل اسم الدليل:",
  "enter_evidence_url": "أدخل رابط الدليل (URL):",
  "error_prefix": "خطأ: ",
  "error_approve": "خطأ أثناء الاعتماد: ",
  "error_reject": "خطأ أثناء عملية الرفض: ",
  "report_saved_notification": "تم إعداد تقرير التقييم الذاتي للمعيار. (المعيار {code})",
  "stage_header": "مرحلة {stage}",
  "maturity_score_header": "درجة مستوى النضج:",
  "merge_data_description": "دمج البيانات لإنشاء تقرير التقييم الذاتي الخاص بك."
};

fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2));
console.log('Translations patched successfully.');
