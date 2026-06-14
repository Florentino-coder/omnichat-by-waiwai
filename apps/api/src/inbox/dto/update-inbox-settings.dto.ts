import { IsInt, Max, Min } from "class-validator";

export class UpdateInboxSettingsDto {
  @IsInt()
  @Min(1)
  @Max(1440)
  inProgressAlertMinutes!: number;
}
