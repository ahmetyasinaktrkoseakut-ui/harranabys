'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, X, Pencil, Trash2, Check, RefreshCw, Eye, FileText, Image as ImageIcon, Sparkles, Square, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { PDFDocument } from 'pdf-lib';

interface EvidenceDoc {
  name: string;
  url: string;
  size?: number;
  highlight_note?: string;
  page_number?: number | string;
  is_annotated?: boolean;
  annotated_url?: string;
}

interface EvidenceAnnotatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: EvidenceDoc | null;
  docIndex: number;
  onSaveAnnotatedDoc: (updatedDoc: EvidenceDoc, oldUrlToDelete?: string) => void;
  isReadOnly?: boolean;
}

export default function EvidenceAnnotatorModal({
  isOpen,
  onClose,
  doc,
  docIndex,
  onSaveAnnotatedDoc,
  isReadOnly = false,
}: EvidenceAnnotatorModalProps) {
  const [highlightNote, setHighlightNote] = useState('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [selectedTool, setSelectedTool] = useState<'highlighter' | 'box'>('highlighter');

  // Solid Pen Color & Size (Mat Normal Kalem)
  const [penColor, setPenColor] = useState<string>('#eab308'); // Solid Yellow
  const [penSize, setPenSize] = useState<number>(8); // Medium 8px solid stroke

  const [isSaving, setIsSaving] = useState(false);
  const [replacingFile, setReplacingFile] = useState(false);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);

  // PDF.js & Canvas Drawing State
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wordContainerRef = useRef<HTMLDivElement | null>(null);
  
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);
  const [mammothLoaded, setMammothLoaded] = useState(false);
  const [html2canvasLoaded, setHtml2canvasLoaded] = useState(false);
  
  const [renderingDoc, setRenderingDoc] = useState(false);
  const [wordHtml, setWordHtml] = useState<string>('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [boxStartPos, setBoxStartPos] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);

  const isImage = doc?.name ? /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.name) : false;
  const isPdf = doc?.name ? /\.pdf$/i.test(doc.name) : false;
  const isOfficeDoc = doc?.name ? /\.docx$/i.test(doc.name) : false;

  // Dynamically Load PDF.js, Mammoth.js & html2canvas from CDN
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Load PDF.js
    if (!(window as any).pdfjsLib) {
      const pScript = document.createElement('script');
      pScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      pScript.onload = () => {
        if ((window as any).pdfjsLib) {
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          setPdfLibLoaded(true);
        }
      };
      document.head.appendChild(pScript);
    } else {
      setPdfLibLoaded(true);
    }

    // Load Mammoth.js for rich Word HTML conversion
    if (!(window as any).mammoth) {
      const mScript = document.createElement('script');
      mScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
      mScript.onload = () => {
        setMammothLoaded(true);
      };
      document.head.appendChild(mScript);
    } else {
      setMammothLoaded(true);
    }

    // Load html2canvas
    if (!(window as any).html2canvas) {
      const hScript = document.createElement('script');
      hScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      hScript.onload = () => {
        setHtml2canvasLoaded(true);
      };
      document.head.appendChild(hScript);
    } else {
      setHtml2canvasLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (doc) {
      setHighlightNote(doc.highlight_note || '');
      const pNum = parseInt(String(doc.page_number || 1), 10);
      setCurrentPage(isNaN(pNum) ? 1 : pNum);
      setReplacementFile(null);
      setReplacingFile(false);
      setHistory([]);
      setWordHtml('');
    }
  }, [doc]);

  // Render Word Document using Mammoth.js
  const renderWordDocument = async () => {
    if (!isOpen || !doc?.url || !isOfficeDoc) return;
    setRenderingDoc(true);

    try {
      if (mammothLoaded && (window as any).mammoth) {
        const res = await fetch(doc.url);
        const arrayBuffer = await res.arrayBuffer();
        const result = await (window as any).mammoth.convertToHtml({ arrayBuffer });
        setWordHtml(result.value);
      }
    } catch (err) {
      console.error('Word rendering error:', err);
    } finally {
      setRenderingDoc(false);
    }
  };

  // Setup Word Canvas Overlay
  useEffect(() => {
    if (isOfficeDoc && wordHtml && wordContainerRef.current && canvasRef.current) {
      const container = wordContainerRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = container.scrollWidth || 800;
      canvas.height = container.scrollHeight || 1000;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([initialState]);
    }
  }, [wordHtml, isOfficeDoc]);

  // Render Image or PDF Page onto Canvas
  const renderDocumentToCanvas = async () => {
    if (!isOpen || !doc?.url || !canvasRef.current) return;
    if (isOfficeDoc) {
      renderWordDocument();
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setRenderingDoc(true);

    try {
      if (isImage) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = doc.url;
        img.onload = () => {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;

          if (baseCanvasRef.current) {
            baseCanvasRef.current.width = w;
            baseCanvasRef.current.height = h;
            const bCtx = baseCanvasRef.current.getContext('2d');
            if (bCtx) bCtx.drawImage(img, 0, 0, w, h);
          }

          canvas.width = w;
          canvas.height = h;
          ctx.clearRect(0, 0, w, h);
          const initialState = ctx.getImageData(0, 0, w, h);
          setHistory([initialState]);
          setRenderingDoc(false);
        };
      } else if (isPdf && pdfLibLoaded && (window as any).pdfjsLib) {
        const pdfjs = (window as any).pdfjsLib;
        const loadingTask = pdfjs.getDocument(doc.url.split('#')[0]);
        const pdf = await loadingTask.promise;
        setTotalPages(pdf.numPages);

        const pageToRender = Math.min(Math.max(1, currentPage), pdf.numPages);
        const page = await pdf.getPage(pageToRender);
        
        const viewport = page.getViewport({ scale: 1.8 });
        const w = Math.round(viewport.width);
        const h = Math.round(viewport.height);

        if (baseCanvasRef.current) {
          baseCanvasRef.current.width = w;
          baseCanvasRef.current.height = h;
          const bCtx = baseCanvasRef.current.getContext('2d');
          if (bCtx) {
            const renderContext = {
              canvasContext: bCtx,
              viewport: viewport,
            };
            await page.render(renderContext).promise;
          }
        }

        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        const initialState = ctx.getImageData(0, 0, w, h);
        setHistory([initialState]);
        setRenderingDoc(false);
      } else {
        setRenderingDoc(false);
      }
    } catch (err) {
      console.error('Document render error:', err);
      setRenderingDoc(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      renderDocumentToCanvas();
    }
  }, [isOpen, doc, currentPage, pdfLibLoaded, mammothLoaded]);

  if (!isOpen || !doc) return null;

  // Exact Mouse Position Mapping
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // Canvas Mouse Events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isReadOnly || !canvasRef.current) return;
    const pos = getCanvasPos(e);
    setIsDrawing(true);
    setLastPos(pos);
    setBoxStartPos(pos);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPos || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const currentPos = getCanvasPos(e);

    if (selectedTool === 'highlighter') {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();

      setLastPos(currentPos);
    } else if (selectedTool === 'box' && boxStartPos && history.length > 0) {
      const lastSnapshot = history[history.length - 1];
      ctx.putImageData(lastSnapshot, 0, 0);

      const width = currentPos.x - boxStartPos.x;
      const height = currentPos.y - boxStartPos.y;
      ctx.save();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 4;
      ctx.strokeRect(boxStartPos.x, boxStartPos.y, width, height);
      ctx.restore();
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const currentPos = getCanvasPos(e);

    if (selectedTool === 'box' && boxStartPos) {
      const width = currentPos.x - boxStartPos.x;
      const height = currentPos.y - boxStartPos.y;
      ctx.save();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 4;
      ctx.strokeRect(boxStartPos.x, boxStartPos.y, width, height);
      ctx.restore();
    }

    const snapshot = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHistory(prev => [...prev, snapshot]);

    setIsDrawing(false);
    setLastPos(null);
    setBoxStartPos(null);
  };

  const handleUndo = () => {
    if (history.length <= 1 || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newHistory = history.slice(0, history.length - 1);
    const lastSnapshot = newHistory[newHistory.length - 1];
    ctx.putImageData(lastSnapshot, 0, 0);
    setHistory(newHistory);
  };

  const handleSaveAnnotated = async () => {
    setIsSaving(true);
    try {
      let finalUrl = doc.url;
      let oldUrlToDelete: string | undefined = undefined;

      // 1. Replacement file upload
      if (replacementFile) {
        oldUrlToDelete = doc.url;
        const fileExt = replacementFile.name.split('.').pop();
        const newFileName = `duzeltilmis_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('dokumanlar').upload(newFileName, replacementFile);
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('dokumanlar').getPublicUrl(newFileName);
        finalUrl = publicUrlData.publicUrl;
      } 
      // 2. Export Word Document Drawing using html2canvas
      else if (isOfficeDoc && wordContainerRef.current && (window as any).html2canvas) {
        oldUrlToDelete = doc.annotated_url || doc.url;
        const htmlCanvas = await (window as any).html2canvas(wordContainerRef.current, { scale: 2, useCORS: true });
        const blob = await new Promise<Blob | null>(resolve => htmlCanvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const cleanName = doc.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^/.]+$/, '');
          const newFileName = `isaretli_word_${Date.now()}_${cleanName}.png`;
          const { error: uploadError } = await supabase.storage.from('dokumanlar').upload(newFileName, blob);
          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage.from('dokumanlar').getPublicUrl(newFileName);
          finalUrl = publicUrlData.publicUrl;
        }
      }
      // 3. Export PDF drawing embedded on target page preserving all pages using pdf-lib
      else if (isPdf && canvasRef.current && history.length > 1) {
        oldUrlToDelete = doc.url;
        const cleanName = doc.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^/.]+$/, '');
        
        try {
          const existingPdfBytes = await fetch(doc.url).then(res => res.arrayBuffer());
          const pdfDoc = await PDFDocument.load(existingPdfBytes);
          
          const canvas = canvasRef.current;
          const drawingPngDataUrl = canvas.toDataURL('image/png');
          const drawingPngImage = await pdfDoc.embedPng(drawingPngDataUrl);

          const pageIndex = Math.max(0, (currentPage || 1) - 1);
          if (pageIndex < pdfDoc.getPageCount()) {
            const targetPage = pdfDoc.getPage(pageIndex);
            const { width, height } = targetPage.getSize();
            
            targetPage.drawImage(drawingPngImage, {
              x: 0,
              y: 0,
              width: width,
              height: height,
            });
          }

          const modifiedPdfBytes = await pdfDoc.save();
          const pdfBlob = new Blob([modifiedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
          const newFileName = `isaretli_${Date.now()}_${cleanName}.pdf`;

          const { error: uploadError } = await supabase.storage.from('dokumanlar').upload(newFileName, pdfBlob);
          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage.from('dokumanlar').getPublicUrl(newFileName);
          finalUrl = publicUrlData.publicUrl;
        } catch (pdfErr: any) {
          console.error("PDF embedding error:", pdfErr);
          alert(`PDF katmanlama hatası oluştu: ${pdfErr?.message || pdfErr}. İşlem iptal edildi.`);
          setIsSaving(false);
          return;
        }
      }
      // 4. Export Image canvas drawing
      else if (canvasRef.current && history.length > 1) {
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = canvasRef.current.width;
        mergedCanvas.height = canvasRef.current.height;
        const mCtx = mergedCanvas.getContext('2d');
        if (mCtx) {
          if (baseCanvasRef.current) mCtx.drawImage(baseCanvasRef.current, 0, 0);
          mCtx.drawImage(canvasRef.current, 0, 0);
        }
        const blob = await new Promise<Blob | null>(resolve => mergedCanvas.toBlob(resolve, 'image/png'));
        
        if (blob) {
          oldUrlToDelete = doc.url;
          const cleanName = doc.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^/.]+$/, '');
          const newFileName = `isaretli_${Date.now()}_${cleanName}.png`;
          const { error: uploadError } = await supabase.storage.from('dokumanlar').upload(newFileName, blob);
          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage.from('dokumanlar').getPublicUrl(newFileName);
          finalUrl = publicUrlData.publicUrl;
        }
      }

      let displayUrl = finalUrl;
      if (isPdf && currentPage && finalUrl === doc.url) {
        const baseUrl = finalUrl.split('#')[0];
        displayUrl = `${baseUrl}#page=${currentPage}`;
      }

      let newDocName = doc.name;
      if (replacementFile) {
        newDocName = replacementFile.name;
      } else if (finalUrl !== doc.url) {
        const ext = finalUrl.endsWith('.pdf') ? '.pdf' : '.png';
        newDocName = `${doc.name.replace(/\.[^/.]+$/, '')}_isaretli${ext}`;
      }

      const updatedDoc: EvidenceDoc = {
        ...doc,
        name: newDocName,
        url: displayUrl,
        size: replacementFile ? Math.round(replacementFile.size / 1024) : doc.size,
        highlight_note: highlightNote,
        page_number: currentPage,
        is_annotated: true,
        annotated_url: finalUrl !== doc.url ? finalUrl : doc.annotated_url
      };

      onSaveAnnotatedDoc(updatedDoc, oldUrlToDelete);
      onClose();
    } catch (err: any) {
      console.error('Annotation save error:', err);
      alert(`İşaretleme kaydedilirken hata oluştu: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${isReadOnly ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {isReadOnly ? <Eye className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                {isReadOnly ? '📄 Kanıt Dokümanı Görüntüleyici' : '✏️ Kanıt İşaretleme & Düzenleme Editörü'}
              </h3>
              <p className="text-[11px] text-slate-300 truncate max-w-md" title={doc.name}>
                {doc.name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TOP DRAWING & NAVIGATION TOOLBAR - HIDE DRAWING TOOLS WHEN READONLY */}
        {(!isReadOnly || isPdf) && (
          <div className="px-5 py-2.5 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 flex-shrink-0">
            
            {/* Drawing Tools & Size/Color Selectors (Only shown in Edit Mode) */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {!isReadOnly ? (
                <>
                  <span className="font-bold text-slate-400 uppercase text-[10px]">Araçlar:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedTool('highlighter')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ${selectedTool === 'highlighter' ? 'bg-amber-400 text-slate-950 shadow-md' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    ✏️ Çizim Kalemi
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTool('box')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ${selectedTool === 'box' ? 'bg-red-600 text-white shadow-md' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                  >
                    <Square className="w-3.5 h-3.5" />
                    🔲 Kırmızı Kutucuk
                  </button>

                  {/* SOLID COLOR PICKER */}
                  {selectedTool === 'highlighter' && (
                    <div className="flex items-center gap-1 bg-slate-900/60 px-2 py-0.5 rounded-lg border border-slate-700">
                      <span className="text-[10px] font-bold text-slate-400">Renk:</span>
                      <button
                        type="button"
                        onClick={() => setPenColor('#eab308')}
                        className={`w-4 h-4 rounded-full bg-amber-400 border ${penColor === '#eab308' ? 'border-white scale-110' : 'border-transparent opacity-70'}`}
                        title="Sarı"
                      />
                      <button
                        type="button"
                        onClick={() => setPenColor('#22c55e')}
                        className={`w-4 h-4 rounded-full bg-emerald-500 border ${penColor === '#22c55e' ? 'border-white scale-110' : 'border-transparent opacity-70'}`}
                        title="Yeşil"
                      />
                      <button
                        type="button"
                        onClick={() => setPenColor('#2563eb')}
                        className={`w-4 h-4 rounded-full bg-blue-600 border ${penColor === '#2563eb' ? 'border-white scale-110' : 'border-transparent opacity-70'}`}
                        title="Mavi"
                      />
                      <button
                        type="button"
                        onClick={() => setPenColor('#dc2626')}
                        className={`w-4 h-4 rounded-full bg-red-600 border ${penColor === '#dc2626' ? 'border-white scale-110' : 'border-transparent opacity-70'}`}
                        title="Kırmızı"
                      />
                      <button
                        type="button"
                        onClick={() => setPenColor('#0f172a')}
                        className={`w-4 h-4 rounded-full bg-slate-900 border ${penColor === '#0f172a' ? 'border-white scale-110' : 'border-transparent opacity-70'}`}
                        title="Siyah"
                      />
                    </div>
                  )}

                  {/* BRUSH SIZE PICKER */}
                  {selectedTool === 'highlighter' && (
                    <div className="flex items-center gap-1 bg-slate-900/60 px-2 py-0.5 rounded-lg border border-slate-700">
                      <button
                        type="button"
                        onClick={() => setPenSize(4)}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${penSize === 4 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                      >
                        İnce
                      </button>
                      <button
                        type="button"
                        onClick={() => setPenSize(8)}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${penSize === 8 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                      >
                        Orta
                      </button>
                      <button
                        type="button"
                        onClick={() => setPenSize(14)}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${penSize === 14 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                      >
                        Kalın
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={history.length <= 1}
                    className="px-2.5 py-1 text-xs font-bold bg-slate-700 text-slate-200 hover:bg-slate-600 rounded-lg disabled:opacity-40 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Geri Al
                  </button>
                </>
              ) : (
                <span className="font-bold text-slate-300 text-xs">🔍 Görüntüleme Modu (Salt Okunur)</span>
              )}
            </div>

            {/* PDF Page Navigation */}
            {isPdf && (
              <div className="flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-0.5 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  className="p-0.5 text-slate-300 hover:text-white disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-bold text-amber-400 whitespace-nowrap">
                  Sayfa {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-0.5 text-slate-300 hover:text-white disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100 flex flex-col">
          
          {/* Note Input (Only shown in Edit Mode or if Note exists) */}
          {!isReadOnly ? (
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex-shrink-0">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Vurgu / İşaretleme Açıklama Notu:
              </label>
              <input
                type="text"
                value={highlightNote}
                onChange={e => setHighlightNote(e.target.value)}
                placeholder="Örn: Akreditasyon kanıtı kırmızı çizim kalemiyle işaretlenmiştir."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          ) : doc.highlight_note ? (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl shadow-sm text-xs font-medium text-amber-900 flex items-center gap-2 flex-shrink-0">
              <span>📌 <strong>İşaretleme Notu:</strong> {doc.highlight_note}</span>
            </div>
          ) : null}

          {/* MAIN INTERACTIVE CANVAS PREVIEW AREA */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-sm flex-1 flex flex-col">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b pb-1.5 flex-shrink-0">
              <span className="flex items-center gap-1.5">
                {isReadOnly ? <Eye className="w-3.5 h-3.5 text-blue-600" /> : <Pencil className="w-3.5 h-3.5 text-amber-600" />}
                {isPdf 
                  ? `PDF Sayfa ${currentPage} Görünümü:` 
                  : isOfficeDoc 
                  ? 'Word Belgesi Orijinal Görünümü:' 
                  : 'Görsel Doküman Görünümü:'}
              </span>
              {renderingDoc && (
                <span className="text-amber-600 flex items-center gap-1 text-[11px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Yükleniyor...
                </span>
              )}
            </div>

            {/* WORKSPACE AREA */}
            {isOfficeDoc ? (
              /* WORD DOCUMENT RICH HTML WORKSPACE (Logos, Formatted Tables & Drawing Overlay) */
              <div className="overflow-y-auto overflow-x-auto bg-slate-900/10 rounded-lg p-4 min-h-[450px] max-h-[60vh] flex justify-center items-start">
                <div ref={wordContainerRef} className="relative bg-white border border-slate-300 shadow-xl rounded-lg p-8 w-full max-w-[850px] min-h-[950px] text-slate-900 font-sans leading-relaxed text-sm">
                  {/* WORD HTML CONTENT (Logos, Tables, Styling) */}
                  <style jsx global>{`
                    .word-content table {
                      width: 100% !important;
                      border-collapse: collapse !important;
                      margin: 1rem 0 !important;
                    }
                    .word-content td, .word-content th {
                      border: 1.5px solid #334155 !important;
                      padding: 6px 10px !important;
                    }
                    .word-content img {
                      max-width: 100% !important;
                      height: auto !important;
                      display: inline-block !important;
                    }
                  `}</style>
                  
                  <div className="word-content" dangerouslySetInnerHTML={{ __html: wordHtml || `<p class="text-slate-400 italic">Word belgesi yükleniyor...</p>` }} />

                  {/* TRANSPARENT DRAWING OVERLAY CANVAS ON TOP OF WORD DOC */}
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className={`absolute inset-0 z-10 w-full h-full ${isReadOnly ? 'pointer-events-none' : 'cursor-crosshair'}`}
                  />
                </div>
              </div>
            ) : (
              /* PDF & IMAGE FULL-RESOLUTION WORKSPACE */
              <div className="overflow-y-auto overflow-x-auto bg-slate-900/10 rounded-lg p-4 min-h-[420px] max-h-[60vh] flex justify-center items-start">
                <div className="relative" style={{ width: '100%', maxWidth: '850px' }}>
                  <canvas
                    ref={baseCanvasRef}
                    className="border border-slate-300 shadow-md rounded bg-white block"
                    style={{ width: '100%', height: 'auto', display: 'block', margin: '0 auto' }}
                  />
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className={`absolute top-0 left-0 w-full h-full ${isReadOnly ? 'cursor-default pointer-events-none' : 'cursor-crosshair'}`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* DÜZELT / YENİSİYLE DEĞİŞTİR (Only shown in Edit Mode) */}
          {!isReadOnly && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-sm flex-shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                  Kanıtı Düzelt / Yenisiyle Değiştir:
                </span>
                <button
                  type="button"
                  onClick={() => setReplacingFile(!replacingFile)}
                  className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                >
                  {replacingFile ? 'İptal Et' : '🔄 Düzeltilmiş Yeni Dosya Seç'}
                </button>
              </div>

              {replacingFile && (
                <div className="p-2.5 bg-emerald-50/60 border border-dashed border-emerald-300 rounded-lg space-y-2">
                  <input
                    type="file"
                    onChange={e => {
                      if (e.target.files && e.target.files.length > 0) {
                        setReplacementFile(e.target.files[0]);
                      }
                    }}
                    className="block w-full text-xs text-slate-700 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                  />
                  {replacementFile && (
                    <div className="p-1.5 bg-white rounded border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Seçilen Yeni Dosya: {replacementFile.name} ({Math.round(replacementFile.size / 1024)} KB)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-1.5 text-xs font-semibold rounded-xl transition-colors ${isReadOnly ? 'bg-slate-800 hover:bg-slate-900 text-white font-bold' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {isReadOnly ? 'Kapat & İncelemeyi Tamamla' : 'Kapat / İptal'}
          </button>

          {!isReadOnly && (
            <button
              type="button"
              onClick={handleSaveAnnotated}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {isSaving ? 'Kaydediliyor...' : 'İşaretleme & Düzeltmeyi Kaydet'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
