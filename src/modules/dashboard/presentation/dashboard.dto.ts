import { Type } from "class-transformer";
import { IsInt, IsUUID, Max, Min, ValidateIf } from "class-validator";
import { PaginationDto } from "../../identity/presentation/user.dto";
/** Bounded horizon and optional clinic filter for administrative metrics. */
export class DashboardQueryDto extends PaginationDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() clinicId?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(365) days = 30;
}
