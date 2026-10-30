import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateConnectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(500)
  baseUrl!: string;
}

export class LookupCustomerDto {
  @IsString()
  @Matches(/^\+?[0-9][0-9\s-]{7,18}$/, { message: "Phone number is invalid" })
  phone!: string;
}

export class LookupOrderParamsDto {
  @IsString()
  @Matches(/^[A-Za-z0-9-]{4,40}$/, { message: "Order number is invalid" })
  orderNumber!: string;
}
