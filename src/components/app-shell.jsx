import { Header } from "@/components/header";

// Wraps every authenticated page so the nav + spacing are consistent.
export function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-[#fbf8f6]">
      <Header />
      <main className="container py-6">{children}</main>
    </div>
  );
}
