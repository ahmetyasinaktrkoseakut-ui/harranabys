import { ClipboardList, Hammer } from 'lucide-react';

export default function GorevlerimPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] p-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 text-center max-w-lg w-full">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <ClipboardList className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">Görevlerim</h2>
        <p className="text-slate-500 mb-6 leading-relaxed">
          Size atanan düzeltici önleyici faaliyetler (DÖF) ve eylem planı görevleri burada listelenecektir.
        </p>
        <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-600 px-4 py-2 rounded-full text-sm font-medium border border-amber-100">
          <Hammer className="w-4 h-4" />
          Yapım Aşamasında
        </div>
      </div>
    </div>
  );
}
