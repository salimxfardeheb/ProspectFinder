/** A company as displayed in the UI, mapped from a Google Place. */
export interface Company {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  websiteUri?: string;
  rating?: number;
  reviewCount?: number;
  googleMapsUri?: string;
}

/** Parameters of a company search, mirrored by the API DTO. */
export interface CompanySearchParams {
  keyword: string;
  latitude: number;
  longitude: number;
  radius: number;
}
