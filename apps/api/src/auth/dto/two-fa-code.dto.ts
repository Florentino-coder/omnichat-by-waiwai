import { IsString, Length } from "class-validator";

export class TwoFaCodeDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
