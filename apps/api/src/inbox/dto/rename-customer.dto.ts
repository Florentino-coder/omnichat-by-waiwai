import { IsString, MaxLength, MinLength } from "class-validator";

export class RenameCustomerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nickname!: string;
}
