"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { CompanyList } from "@/components/company-list";
import { SearchForm } from "@/components/search-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { searchCompanies } from "@/lib/api/google-places";
import type { CompanySearchParams } from "@/types/company";

const DEFAULT_SEARCH: CompanySearchParams = {
  keyword: "Restaurant",
  latitude: 35.6971,
  longitude: -0.6308,
  radius: 20000,
};

export function CompanySearch() {
  const [params, setParams] = useState<CompanySearchParams | null>(null);

  const { data: companies, isFetching, error } = useQuery({
    queryKey: ["company-search", params],
    queryFn: () => searchCompanies(params as CompanySearchParams),
    enabled: params !== null,
  });

  return (
    <div className="flex flex-col gap-8">
      <SearchForm defaultValues={DEFAULT_SEARCH} isLoading={isFetching} onSearch={setParams} />

      {error && !isFetching && (
        <Alert variant="destructive">
          <AlertTitle>La recherche a échoué</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {isFetching && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner />
          Recherche des entreprises…
        </div>
      )}

      {companies && !isFetching && !error && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            {companies.length} entreprise{companies.length > 1 ? "s" : ""} trouvée
            {companies.length > 1 ? "s" : ""}
          </h2>
          <CompanyList companies={companies} />
        </section>
      )}
    </div>
  );
}
