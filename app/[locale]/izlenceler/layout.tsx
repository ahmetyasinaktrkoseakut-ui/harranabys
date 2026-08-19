import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import Footer from '@/components/Footer';

export default async function IzlencelerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={messages}>
      <div className="bg-white min-h-screen text-slate-900 font-sans flex flex-col justify-between">
        <div className="flex-1">
          {children}
        </div>
        <Footer />
      </div>
    </NextIntlClientProvider>
  );
}
