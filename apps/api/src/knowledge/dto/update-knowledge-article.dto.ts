import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateKnowledgeArticleDto {
  @IsOptional()
  @IsString()
  lineChannelId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  content?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
