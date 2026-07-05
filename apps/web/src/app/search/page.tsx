import type { Metadata } from "next";

import { CompanySearch } from "@/components/company-search";

export const metadata: Metadata = {
  title: "Recherche d'entreprises — ProspectFinder",
  description: "Recherchez des entreprises à prospecter via Google Places",
};

export default function SearchPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Recherche d&apos;entreprises</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trouvez des entreprises à prospecter autour d&apos;une position géographique.
        </p>
      </header>
      <CompanySearch />
    </main>
  );
}
