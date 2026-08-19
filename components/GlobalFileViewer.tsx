'use client';

import { useEffect, useState } from 'react';
import { X, Download, FileText, Image as ImageIcon, ExternalLink, Loader2 } from 'lucide-react';

export default function GlobalFileViewer() {
  const [isOpen, setIsOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState('');
  const [viewerType, setViewerType] = useState<'pdf' | 'image' | 'docx'>('pdf');
  const [viewerName, setViewerName] = useState('');
  const [wordHtml, setWordHtml] = useState<string>('');
  const [loadingDocx, setLoadingDocx] = useState(false);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor && anchor.href) {
        const url = anchor.href;
        const isDownload = anchor.hasAttribute('download');

        const isSupabaseFile = url.includes('/storage/v1/object/public/');
        const cleanUrl = url.split(/[?#]/)[0].toLowerCase();
        const isPdf = cleanUrl.endsWith('.pdf') || (isSupabaseFile && url.toLowerCase().includes('.pdf'));
        const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(cleanUrl) || (isSupabaseFile && (url.toLowerCase().includes('.png') || url.toLowerCase().includes('.jpg') || url.toLowerCase().includes('.jpeg')));
        const isDocx = cleanUrl.endsWith('.docx') || (isSupabaseFile && url.toLowerCase().includes('.docx'));

        if ((isPdf || isImage || isDocx) && !isDownload) {
          e.preventDefault();
          e.stopPropagation();
          setViewerUrl(url);
          setViewerType(isPdf ? 'pdf' : isDocx ? 'docx' : 'image');

          let name = 'Doküman';
          try {
            const decoded = decodeURIComponent(url);
            name = decoded.substring(decoded.lastIndexOf('/') + 1).split(/[?#]/)[0];
          } catch (_) {}
          setViewerName(name);
          setIsOpen(true);
        }
      }
    };

    document.addEventListener('click', handleGlobalClick, { capture: true });
    return () => document.removeEventListener('click', handleGlobalClick, { capture: true });
  }, []);

  useEffect(() => {
    if (isOpen && viewerType === 'docx' && viewerUrl) {
      setLoadingDocx(true);
      setWordHtml('');
      const renderWord = async () => {
        try {
          if (!(window as any).mammoth) {
            const mScript = document.createElement('script');
            mScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
            mScript.onload = async () => {
              if ((window as any).mammoth) {
                const res = await fetch(viewerUrl);
                const arrayBuffer = await res.arrayBuffer();
                const result = await (window as any).mammoth.convertToHtml({ arrayBuffer });
                setWordHtml(result.value);
              }
            };
            document.head.appendChild(mScript);
          } else {
            const res = await fetch(viewerUrl);
            const arrayBuffer = await res.arrayBuffer();
            const result = await (window as any).mammoth.convertToHtml({ arrayBuffer });
            setWordHtml(result.value);
          }
        } catch (err) {
          console.error('Word render error:', err);
        } finally {
          setLoadingDocx(false);
        }
      };
      renderWord();
    }
  }, [isOpen, viewerType, viewerUrl]);

  const handleDownload = async () => {
    try {
      const response = await fetch(viewerUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = viewerName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (_) {
      const link = document.createElement('a');
      link.href = viewerUrl;
      link.download = viewerName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#0f1e36] w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50 dark:bg-[#0d1b30]">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-[#9e7f59] rounded-xl font-bold text-xs">
              {viewerType.toUpperCase()}
            </span>
            <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[50vw]" title={viewerName}>
              {viewerName}
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href={viewerUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="p-2 hover:bg-slate-100 dark:hover:bg-[#1e2d4a] rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Yeni Sekmede Aç"
            >
              <ExternalLink className="w-4 h-4" /> Yeni Sekmede Aç
            </a>
            <button 
              onClick={handleDownload}
              className="p-2 hover:bg-slate-100 dark:hover:bg-[#1e2d4a] rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="İndir"
            >
              <Download className="w-4 h-4" /> İndir
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-[#1e2d4a] rounded-xl text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="flex-1 bg-slate-900/5 dark:bg-black/30 overflow-auto p-4 flex items-center justify-center min-h-[400px]">
          {viewerType === 'image' ? (
            <img 
              src={viewerUrl} 
              alt={viewerName} 
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-lg border border-slate-200 dark:border-slate-800"
            />
          ) : viewerType === 'docx' ? (
            <div className="w-full max-w-[850px] bg-white border border-slate-200 shadow-xl rounded-xl p-8 max-h-[75vh] overflow-y-auto font-sans leading-relaxed text-sm text-slate-900">
              <style jsx global>{`
                .global-word-content table {
                  width: 100% !important;
                  border-collapse: collapse !important;
                  margin: 1rem 0 !important;
                }
                .global-word-content td, .global-word-content th {
                  border: 1.5px solid #334155 !important;
                  padding: 6px 10px !important;
                }
                .global-word-content img {
                  max-width: 100% !important;
                  height: auto !important;
                  display: inline-block !important;
                }
              `}</style>
              {loadingDocx ? (
                <div className="p-12 text-center text-slate-500 font-semibold flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Word Belgesi Yükleniyor...
                </div>
              ) : (
                <div className="global-word-content" dangerouslySetInnerHTML={{ __html: wordHtml || '<p class="text-slate-400 italic">Doküman içeriği görüntülenemedi.</p>' }} />
              )}
            </div>
          ) : (
            <iframe 
              src={`${viewerUrl}#toolbar=0`} 
              title={viewerName} 
              className="w-full h-[75vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-[#0d1b30] border-t border-slate-100 dark:border-slate-800/80 flex justify-end">
          <button
            onClick={() => setIsOpen(false)}
            className="px-5 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-xl text-xs font-bold transition-colors"
          >
            Kapat & İncelemeyi Tamamla
          </button>
        </div>

      </div>
    </div>
  );
}
