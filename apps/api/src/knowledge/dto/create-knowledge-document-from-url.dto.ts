import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength
} from "class-validator";

export class CreateKnowledgeDocumentFromUrlDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  sourceUrl!: string;

  @IsOptional()
  @IsString()
  lineChannelId?: string;
}
