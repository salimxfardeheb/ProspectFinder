import { ExternalLink, Globe, MapPin, Phone, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Company } from "@/types/company";

export function CompanyCard({ company }: { company: Company }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-base leading-snug">{company.name}</CardTitle>
        {typeof company.rating === "number" && (
          <CardDescription className="flex items-center gap-1.5">
            <Star aria-hidden className="size-4 fill-amber-400 text-amber-400" />
            <span className="font-medium text-foreground">{company.rating.toFixed(1)}</span>
            <span>
              · {company.reviewCount ?? 0} avis
            </span>
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-2 text-sm text-muted-foreground">
        {company.address && (
          <p className="flex items-start gap-2">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
            {company.address}
          </p>
        )}
        {company.phone && (
          <p className="flex items-center gap-2">
            <Phone aria-hidden className="size-4 shrink-0" />
            <a href={`tel:${company.phone}`} className="hover:text-foreground hover:underline">
              {company.phone}
            </a>
          </p>
        )}
        {company.websiteUri && (
          <p className="flex items-center gap-2 overflow-hidden">
            <Globe aria-hidden className="size-4 shrink-0" />
            <a
              href={company.websiteUri}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:text-foreground hover:underline"
            >
              {company.websiteUri}
            </a>
          </p>
        )}
      </CardContent>

      {company.googleMapsUri && (
        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            render={
              <a href={company.googleMapsUri} target="_blank" rel="noopener noreferrer">
                Voir sur Google Maps
                <ExternalLink aria-hidden />
              </a>
            }
          />
        </CardFooter>
      )}
    </Card>
  );
}
