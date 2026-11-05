import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf
} from "class-validator";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import { PaginationDto } from "../../identity/presentation/user.dto";
import type { PreventionStatus } from "../domain/prevention.repository";
/**
 * Defines the validated prevention, dashboard or notification contract.
 */
export class PreventionTypeDto extends AuditReasonDto {
  @IsString() @Matches(/^[a-z][a-z0-9-]{1,59}$/) code!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 120)
  name!: string;
  @IsBoolean() enabled!: boolean;
}
/**
 * Defines the validated prevention, dashboard or notification contract.
 */
export class PreventionScheduleDto extends AuditReasonDto {
  @IsISO8601({ strict: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) dueAt!: string;
  @IsIn(["planned", "scheduled"]) status!: "planned" | "scheduled";
  @ValidateIf((_o, v) => v !== null) @IsInt() @Min(1) @Max(120) intervalMonths!: number | null;
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(8760, { each: true })
  reminderHours: number[] = [168, 24];
  @ValidateIf((_o, v) => v !== undefined && v !== null) @IsString() @Length(1, 200) externalReference?: string | null;
}
/**
 * Defines the validated prevention, dashboard or notification contract.
 */
export class CreatePreventiveEventDto extends PreventionScheduleDto {
  @IsUUID() patientId!: string;
  @IsUUID() clinicId!: string;
  @IsUUID() typeId!: string;
  @IsUUID() idempotencyKey!: string;
}
/**
 * Defines the validated prevention, dashboard or notification contract.
 */
export class UpdatePreventiveEventDto extends PreventionScheduleDto {
  @IsInt() @Min(1) expectedVersion!: number;
}
/**
 * Defines the validated prevention, dashboard or notification contract.
 */
export class EventVersionDto extends AuditReasonDto {
  @IsInt() @Min(1) expectedVersion!: number;
}
/**
 * Defines the validated prevention, dashboard or notification contract.
 */
export class CompletePreventiveEventDto extends EventVersionDto {
  @IsISO8601({ strict: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) occurredAt!: string;
}
/**
 * Defines the validated prevention, dashboard or notification contract.
 */
export class PreventionQueryDto extends PaginationDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() patientId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() clinicId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() typeId?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(["planned", "scheduled", "completed", "cancelled"])
  status?: PreventionStatus;
  @ValidateIf((_o, v) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  from?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  to?: string;
}
