import { IsArray, ArrayMinSize, ArrayUnique, MaxLength as RoleMaxLength } from "class-validator";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEmail, IsInt, IsString, Length, Matches, Max, Min, ValidateIf } from "class-validator";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
/** Validates a new clinic. */
export class CreateClinicDto extends AuditReasonDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{0,29}$/)
  code!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 120)
  name!: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 500)
  address?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/^[+0-9() .-]{5,30}$/)
  phone?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  @Length(1, 254)
  email?: string | null;
}
/** Validates explicit profile or status changes. */
export class UpdateClinicDto extends AuditReasonDto {
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{0,29}$/)
  code?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 120)
  name?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 500)
  address?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/^[+0-9() .-]{5,30}$/)
  phone?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  @Length(1, 254)
  email?: string | null;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() enabled?: boolean;
}
/** Restricts lists to bounded, explicit filters. */
export class ClinicQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @Type(() => Number) @IsInt() @Min(0) offset = 0;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  search?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(({ value }) => (value === "true" ? true : value === "false" ? false : value))
  @IsBoolean()
  enabled?: boolean;
}

/** Explicit role assignment for one clinic; an empty assignment is removed through DELETE. */
export class AssignClinicStaffDto extends AuditReasonDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @RoleMaxLength(60, { each: true })
  @Matches(/^[a-z][a-z0-9-]{1,59}$/, { each: true })
  roles!: string[];
}
