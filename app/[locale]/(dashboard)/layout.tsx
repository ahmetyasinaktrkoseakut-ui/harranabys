import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-900 text-slate-800 font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <Header />
        <div className="flex-1 overflow-auto bg-slate-50 flex flex-col justify-between">
          <div className="flex-1">
            {children}
          </div>
          <Footer />
        </div>
      </main>
    </div>
  );
}
