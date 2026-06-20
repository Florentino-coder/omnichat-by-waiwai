import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";

export class CreateKnowledgeDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(100000)
  rawText!: string;

  @IsOptional()
  @IsString()
  lineChannelId?: string;

  @IsOptional()
  @IsBoolean()
  reindex?: boolean;
}
