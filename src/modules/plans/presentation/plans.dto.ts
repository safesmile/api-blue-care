import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf
} from "class-validator";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
/** Creates a commercial identity without assuming prices or activating subscriptions. */
export class CreatePlanDto extends AuditReasonDto {
  @IsString() @Matches(/^[a-z][a-z0-9-]{1,59}$/) code!: string;
}
/** Both prices are independent final GTQ amounts in cents. */
export class PlanVersionDto extends AuditReasonDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 120)
  name!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 2000)
  description!: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @Length(1, 500, { each: true })
  benefitDescriptions?: string[];
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsUUID("all", { each: true })
  benefitIds?: string[];
  @ValidateIf((_object, value) => value !== undefined) @IsInt() @Min(0) @Max(100) maxBeneficiaries?: number;
  @IsInt() @Min(500) @Max(100000000) monthlyPriceCents!: number;
  @IsInt() @Min(500) @Max(1000000000) annualPriceCents!: number;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 1000)
  taxDisclosure!: string;
}
/** Stops new contracts while preserving published rights and existing prices. */
export class UpdatePlanDto extends AuditReasonDto {
  @IsBoolean() enabled!: boolean;
}
/** Identifies the desired assignment state. */
export class AssignPlanBenefitDto extends AuditReasonDto {
  @IsBoolean() assigned!: boolean;
}
