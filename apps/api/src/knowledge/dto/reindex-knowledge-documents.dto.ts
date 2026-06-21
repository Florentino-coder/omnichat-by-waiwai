import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";

export class ReindexKnowledgeDocumentsDto {
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  documentIds?: string[];

  @IsOptional()
  @IsString()
  lineChannelId?: string;

  @IsOptional()
  @IsBoolean()
  all?: boolean;
}
