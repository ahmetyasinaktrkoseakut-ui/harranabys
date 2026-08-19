const fs = require('fs');
const path = require('path');

const locales = ['en', 'tr', 'ar'];

locales.forEach(locale => {
  const filePath = path.join(__dirname, 'messages', `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Surveys namespace
  if (!data.Surveys) data.Surveys = {};
  if (!data.Surveys.survey_title) {
    if (locale === 'en') data.Surveys.survey_title = "SURVEY TITLE";
    if (locale === 'tr') data.Surveys.survey_title = "ANKET BAŞLIĞI";
    if (locale === 'ar') data.Surveys.survey_title = "عنوان الاستبيان";
  }

  // SelfEvaluation namespace
  if (!data.SelfEvaluation) data.SelfEvaluation = {};
  if (!data.SelfEvaluation.merge_data_description) {
    if (locale === 'en') data.SelfEvaluation.merge_data_description = "Merge data to create your Institutional Self-Evaluation Report.";
    if (locale === 'tr') data.SelfEvaluation.merge_data_description = "Özdeğerlendirme Raporunuzu oluşturmak için verileri birleştirin.";
    if (locale === 'ar') data.SelfEvaluation.merge_data_description = "دمج البيانات لإنشاء تقرير التقييم الذاتي الخاص بك.";
  }

  // Common namespace for "read_only"
  if (!data.Common) data.Common = {};
  if (!data.Common.read_only) {
    if (locale === 'en') data.Common.read_only = "Read Only";
    if (locale === 'tr') data.Common.read_only = "Sadece Okunur";
    if (locale === 'ar') data.Common.read_only = "قراءة فقط";
  }

  // Assignments namespace
  if (!data.Assignments) data.Assignments = {};
  if (!data.Assignments.access_start) {
    if (locale === 'en') data.Assignments.access_start = "Access Start";
    if (locale === 'tr') data.Assignments.access_start = "Erişim Başlangıç";
    if (locale === 'ar') data.Assignments.access_start = "بداية الوصول";
  }
  if (!data.Assignments.access_end) {
    if (locale === 'en') data.Assignments.access_end = "Access End";
    if (locale === 'tr') data.Assignments.access_end = "Erişim Bitiş";
    if (locale === 'ar') data.Assignments.access_end = "نهاية الوصول";
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Updated ${locale}.json`);
});
