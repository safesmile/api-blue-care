import { Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsString, Length, Matches, Max, Min } from "class-validator";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
/** Creates a commercial identity without assuming prices or activating subscriptions. */
export class CreatePlanDto extends AuditReasonDto {
  @IsString() @Matches(/^[a-z][a-z0-9-]{1,59}$/) code!: string;
}
/** All amounts are final GTQ cents; annual totals are derived as ten monthly totals. */
export class PlanVersionDto extends AuditReasonDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 120)
  name!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 2000)
  description!: string;
  @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @Length(1, 500, { each: true }) benefitDescriptions!: string[];
  @IsInt() @Min(500) @Max(100000000) monthlyPriceCents!: number;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 1000)
  taxDisclosure!: string;
}
/** Stops new contracts while preserving published rights and existing prices. */
export class UpdatePlanDto extends AuditReasonDto {
  @IsBoolean() enabled!: boolean;
}
