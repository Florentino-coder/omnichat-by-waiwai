import { IsOptional, IsString } from "class-validator";

export class ListAiScenariosDto {
  @IsOptional()
  @IsString()
  lineChannelId?: string;
}
