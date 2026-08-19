'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, File, ExternalLink, Download, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';

interface DokumanItem {
  name: string;
  url: string;
  size?: number;
  olcut_id: string;
  asama: string;
  olcut_adi?: string;
  olusturulma_tarihi?: string;
}

export default function DokumanlarPage() {
  const [documents, setDocuments] = useState<DokumanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const locale = useLocale();
  const t = useTranslations('Documents');
  const commonT = useTranslations('Common');
  const reportsT = useTranslations('Reports');

  useEffect(() => {
    async function checkRoleAndFetchDocs() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = '/login';
          return;
        }

        const { data: profile } = await supabase
          .from('profiller')
          .select('rol')
          .eq('id', user.id)
          .maybeSingle();

        const role = (profile?.rol || '').toLowerCase().trim();
        const authorized = role.includes('admin') || role.includes('yönetici') || role.includes('yonetici') || role.includes('gözlemci') || role.includes('gozlemci');
        
        setIsAuthorized(authorized);

        if (!authorized) {
          setIsLoading(false);
          return;
        }

        const { data } = await supabase
          .from('puko_degerlendirmeleri')
          .select('alt_olcut_id, puko_asamasi, kanit_dosyalari, olusturulma_tarihi, alt_olcutler(olcut_adi, olcut_adi_en, olcut_adi_ar, kod)');

        if (data) {
          const allDocs: DokumanItem[] = [];
          data.forEach((row: any) => {
            if (row.kanit_dosyalari && Array.isArray(row.kanit_dosyalari)) {
              row.kanit_dosyalari.forEach((doc: any) => {
                allDocs.push({
                  name: doc.name,
                  url: doc.url,
                  size: doc.size,
                  olcut_id: row.alt_olcutler?.kod || row.alt_olcut_id,
                  olcut_adi: getLocalizedField(row.alt_olcutler, 'olcut_adi', locale) || 'Bilinmiyor',
                  asama: row.puko_asamasi,
                  olusturulma_tarihi: row.olusturulma_tarihi
                });
              });
            }
          });
          setDocuments(allDocs);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    checkRoleAndFetchDocs();
  }, [locale]);

  const filteredDocs = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    doc.olcut_id?.toString().toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isAuthorized === false) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] p-8">
        <div className="bg-red-50 p-10 rounded-3xl border border-red-200 text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-700 mb-2">{reportsT('unauthorized_access')}</h2>
          <p className="text-red-500">{reportsT('unauthorized_desc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{t('title') || 'Kurumsal Doküman Yönetimi'}</h2>
          <p className="text-slate-600 mt-1 text-sm font-medium">{t('description') || 'Sisteme yüklenen tüm PUKÖ kanıt dosyaları ve belgeler.'}</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder={t('search_placeholder') || "Doküman veya ölçüt ara..."} 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-20 flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-widest">{t('table.file_name')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-widest">{t('table.related_criteria')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-widest">{t('table.phase')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-widest">{t('table.size')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-widest text-right">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-500">
                      <File className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                      {t('no_document_found') || 'Sistemde kayıtlı doküman bulunamadı.'}
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((doc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-blue-50 text-blue-500 flex items-center justify-center">
                            <File className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700 max-w-[300px] truncate" title={doc.name}>
                              {doc.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
                          {doc.olcut_id}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1 max-w-[200px] truncate" title={doc.olcut_adi}>{doc.olcut_adi}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="capitalize text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">
                          {doc.asama.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-500">{doc.size ? `${doc.size} KB` : '-'}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <a 
                          href={doc.url} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 font-medium text-xs hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> {t('view') || 'Görüntüle'}
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
