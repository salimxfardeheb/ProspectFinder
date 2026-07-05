import type { Company, CompanySearchParams } from "@/types/company";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Shape returned by the NestJS endpoint (Google Places passthrough). */
interface GooglePlacesSearchResponse {
  places?: GooglePlace[];
}

interface GooglePlace {
  id: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function searchCompanies(params: CompanySearchParams): Promise<Company[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/google-places/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch {
    throw new ApiError("Impossible de contacter le serveur. Vérifiez que l'API est démarrée.", 0);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : (body?.message ?? `La recherche a échoué (HTTP ${response.status}).`);
    throw new ApiError(message, response.status);
  }

  const data = (await response.json()) as GooglePlacesSearchResponse;
  return (data.places ?? []).map(toCompany);
}

function toCompany(place: GooglePlace): Company {
  return {
    id: place.id,
    name: place.displayName?.text ?? "Nom inconnu",
    address: place.formattedAddress,
    phone: place.nationalPhoneNumber,
    websiteUri: place.websiteUri,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    googleMapsUri: place.googleMapsUri,
  };
}
