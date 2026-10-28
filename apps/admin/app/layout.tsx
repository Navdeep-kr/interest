import './globals.css';
import { AdminAuthProvider } from '../lib/rbac';
import { AdminShell } from '../components/AdminShell';

export const metadata = {
  title: 'Interest Operations & Admin Portal',
  description: 'Mission Control: Users, Moderation, Taxonomy, Feature Flags, Analytics & Payouts',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-zinc-100 antialiased selection:bg-rose-500 selection:text-white">
        <AdminAuthProvider>
          <AdminShell>{children}</AdminShell>
        </AdminAuthProvider>
      </body>
    </html>
  );
}
