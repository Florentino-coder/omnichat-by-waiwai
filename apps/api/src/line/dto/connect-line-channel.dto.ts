import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";

export class ConnectLineChannelDto {
  @IsString()
  @MinLength(1)
  workspaceId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  badgeColor!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(64)
  lineChannelId!: string;

  @IsString()
  @MinLength(8)
  channelSecret!: string;

  @IsString()
  @MinLength(8)
  channelAccessToken!: string;

  @IsOptional()
  @IsDateString()
  tokenExpiresAt?: string;
}
