export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface LocalizedText {
  text: string;
  languageCode?: string;
}

/**
 * Subset of a Place returned by Google Places API (New),
 * limited to the fields requested in the X-Goog-FieldMask header.
 */
export interface GooglePlace {
  id: string;
  displayName?: LocalizedText;
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  location?: LatLng;
  googleMapsUri?: string;
}

/** Response body of POST /v1/places:searchText. */
export interface GooglePlacesSearchResponse {
  places?: GooglePlace[];
}

/** Request body of POST /v1/places:searchText. */
export interface GooglePlacesSearchRequest {
  textQuery: string;
  locationBias: {
    circle: {
      center: LatLng;
      radius: number;
    };
  };
}

/** Shape of the error payload returned by Google APIs. */
export interface GoogleApiErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}
