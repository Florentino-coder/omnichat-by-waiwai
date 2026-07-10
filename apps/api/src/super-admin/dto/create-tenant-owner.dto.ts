import { IsEmail, IsOptional, IsString, MinLength, MaxLength } from "class-validator";

export class CreateTenantOwnerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  tenantName!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  ownerPassword!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  ownerDisplayName!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  ownerUsername?: string;

  @IsOptional()
  @IsString()
  planId?: string;
}
