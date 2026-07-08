import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class GeocodeAddressDto {
  @IsString()
  @IsNotEmpty()
  keyword!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  country!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  state?: string;
}
