import { IsString, Matches, MaxLength } from "class-validator";

export class ConnectTermwaiDto {
  @IsString()
  @MaxLength(200)
  @Matches(/^\s*twchat_[A-Za-z0-9_-]+\s*$/, { message: "API key format is invalid" })
  apiKey!: string;
}

export class LookupTermwaiCustomerDto {
  @IsString()
  @Matches(/^\+?[0-9][0-9\s-]{7,18}$/, { message: "Phone number is invalid" })
  phone!: string;
}

export class TermwaiOrderParamsDto {
  @IsString()
  @Matches(/^[A-Za-z0-9-]{4,40}$/, { message: "Order number is invalid" })
  orderNumber!: string;
}
