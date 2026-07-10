import { GeocodeAddressDto } from "../../geocoding/dto/geocode-address.dto";

/** Same validated shape as GeocodeAddressDto: the search-engine geocodes the city itself before searching. */
export class SearchCompaniesDto extends GeocodeAddressDto {}
