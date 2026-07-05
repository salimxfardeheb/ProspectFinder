"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { CompanySearchParams } from "@/types/company";

const searchFormSchema = z.object({
  keyword: z.string().trim().min(1, "Le mot-clé est obligatoire"),
  latitude: z
    .number("La latitude doit être un nombre")
    .min(-90, "La latitude doit être comprise entre -90 et 90")
    .max(90, "La latitude doit être comprise entre -90 et 90"),
  longitude: z
    .number("La longitude doit être un nombre")
    .min(-180, "La longitude doit être comprise entre -180 et 180")
    .max(180, "La longitude doit être comprise entre -180 et 180"),
  radius: z
    .number("Le rayon doit être un nombre")
    .positive("Le rayon doit être supérieur à 0")
    .max(50_000, "Le rayon ne peut pas dépasser 50 000 m"),
});

type SearchFormValues = z.infer<typeof searchFormSchema>;

interface SearchFormProps {
  defaultValues: CompanySearchParams;
  isLoading: boolean;
  onSearch: (params: CompanySearchParams) => void;
}

export function SearchForm({ defaultValues, isLoading, onSearch }: SearchFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SearchFormValues>({
    resolver: zodResolver(searchFormSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSearch)} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.keyword}>
          <FieldLabel htmlFor="keyword">Mot-clé</FieldLabel>
          <Input
            id="keyword"
            placeholder="Restaurant, coiffeur, garage…"
            aria-invalid={!!errors.keyword}
            {...register("keyword")}
          />
          <FieldError errors={[errors.keyword]} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field data-invalid={!!errors.latitude}>
            <FieldLabel htmlFor="latitude">Latitude</FieldLabel>
            <Input
              id="latitude"
              type="number"
              step="any"
              aria-invalid={!!errors.latitude}
              {...register("latitude", { valueAsNumber: true })}
            />
            <FieldError errors={[errors.latitude]} />
          </Field>

          <Field data-invalid={!!errors.longitude}>
            <FieldLabel htmlFor="longitude">Longitude</FieldLabel>
            <Input
              id="longitude"
              type="number"
              step="any"
              aria-invalid={!!errors.longitude}
              {...register("longitude", { valueAsNumber: true })}
            />
            <FieldError errors={[errors.longitude]} />
          </Field>

          <Field data-invalid={!!errors.radius}>
            <FieldLabel htmlFor="radius">Rayon (m)</FieldLabel>
            <Input
              id="radius"
              type="number"
              min={1}
              aria-invalid={!!errors.radius}
              {...register("radius", { valueAsNumber: true })}
            />
            <FieldError errors={[errors.radius]} />
          </Field>
        </div>

        <Field>
          <Button type="submit" disabled={isLoading} className="w-full sm:w-fit">
            {isLoading && <Spinner />}
            {isLoading ? "Recherche en cours…" : "Rechercher"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
