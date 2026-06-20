import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateKnowledgeArticleDto {
  @IsOptional()
  @IsString()
  lineChannelId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
