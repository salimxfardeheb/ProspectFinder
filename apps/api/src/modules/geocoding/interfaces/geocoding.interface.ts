export interface GeocodingLatLng {
  lat: number;
  lng: number;
}

export interface GeocodingViewport {
  northeast: GeocodingLatLng;
  southwest: GeocodingLatLng;
}

/** Coordinates resolved from a keyword/city/country/state request. */
export interface GeocodeResult {
  latitude: number;
  longitude: number;
  viewport: GeocodingViewport;
  formattedAddress: string;
}

/** Subset of the Google Geocoding API response body. */
export interface GoogleGeocodingResponse {
  status: string;
  error_message?: string;
  results: Array<{
    formatted_address: string;
    geometry: {
      location: GeocodingLatLng;
      viewport: GeocodingViewport;
    };
  }>;
}
