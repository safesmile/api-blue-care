import { ListQueryDto } from "../../../shared/presentation/list-query.dto";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested
} from "class-validator";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import { PaginationDto } from "../../identity/presentation/user.dto";
import type { BenefitAudience, BenefitKind, BenefitPeriod } from "../domain/benefit.repository";
/** Each published revision applies to existing members without resetting usage. */
export class BenefitVersionDto extends AuditReasonDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 120)
  name!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 1500)
  description!: string;
  @IsInt() @Min(1) @Max(100000) limitUnits!: number;
  @ValidateIf((_o, v) => v !== undefined && v !== null) @IsInt() @Min(1) @Max(10000) discountBasisPoints?:
    number | null;
  @IsBoolean() enabled!: boolean;
}
/** Creates the stable identity and optionally its first draft in one operation. */
export class CreateBenefitDto extends AuditReasonDto {
  @ValidateIf((_object, value) => value !== undefined) @IsUUID() planId?: string;
  @IsString() @Matches(/^[a-z][a-z0-9-]{1,59}$/) code!: string;
  @IsIn(["discount", "service", "item"]) kind!: BenefitKind;
  @IsIn(["monthly", "annual", "contract"]) period!: BenefitPeriod;
  @IsIn(["holder", "beneficiaries", "all"]) audience!: BenefitAudience;
  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => BenefitVersionDto)
  initialVersion?: BenefitVersionDto;
}
/** Bounds catalog filtering to a known plan. */
export class BenefitQueryDto extends ListQueryDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() planId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() availableForPlanId?: string;
}
/** Omitting a beneficiary selects the holder, never a shared family balance. */
export class BalanceQueryDto extends PaginationDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() beneficiaryId?: string;
}
/** Additional family capacity excludes the holder and preserves existing registrations when reduced. */
export class FamilySettingsDto extends AuditReasonDto {
  @IsInt() @Min(0) @Max(100) maxBeneficiaries!: number;
}
/** Minimal dependent profile; no separate account is created. */
export class BeneficiaryDto extends AuditReasonDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  firstName!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  lastName!: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birthDate?: string | null;
}
/** Presentation proves a selected benefit and recipient but never reserves quota. */
export class BenefitTicketDto extends AuditReasonDto {
  @IsUUID() benefitId!: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null) @IsUUID() beneficiaryId?: string | null;
  @IsInt() @Min(1) @Max(1000) units!: number;
}
/** Staff can identify a service and operation, but cannot choose an actor, date or available balance. */
export class ConsumeBenefitDto extends BenefitTicketDto {
  @IsUUID() membershipId!: string;
  @IsUUID() clinicId!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 120)
  serviceReference!: string;
  @IsUUID() idempotencyKey!: string;
}
/** Bound ticket identity and units come exclusively from the server record. */
export class ConsumeTicketDto extends AuditReasonDto {
  @IsString() @Length(80, 80) @Matches(/^[a-f0-9]+$/) token!: string;
  @IsUUID() clinicId!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 120)
  serviceReference!: string;
  @IsUUID() idempotencyKey!: string;
}
/** Correction reason is mandatory and deliberately does not inherit the optional audit reason condition. */
export class ReverseConsumptionDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 500)
  reason!: string;
  @IsUUID() idempotencyKey!: string;
}
