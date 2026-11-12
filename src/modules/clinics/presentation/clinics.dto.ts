import { ListQueryDto } from "../../../shared/presentation/list-query.dto";
import { IsArray, ArrayMinSize, ArrayUnique, IsIn, MaxLength as RoleMaxLength } from "class-validator";
import { CLINIC_COLORS, CLINIC_ICONS, type ClinicColor, type ClinicIcon } from "../domain/clinic.repository";
import { Transform } from "class-transformer";
import { IsBoolean, IsEmail, IsString, Length, Matches, ValidateIf } from "class-validator";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
/** Validates a new clinic. */
export class CreateClinicDto extends AuditReasonDto {
  @ValidateIf((_o, value) => value !== undefined) @IsIn(CLINIC_ICONS) icon?: ClinicIcon;
  @ValidateIf((_o, value) => value !== undefined) @IsIn(CLINIC_COLORS) color?: ClinicColor;
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().replace(/[A-Z]/g, letter => letter.toLowerCase()) : value
  )
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
  @ValidateIf((_o, value) => value !== undefined) @IsIn(CLINIC_ICONS) icon?: ClinicIcon;
  @ValidateIf((_o, value) => value !== undefined) @IsIn(CLINIC_COLORS) color?: ClinicColor;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().replace(/[A-Z]/g, letter => letter.toLowerCase()) : value
  )
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
export class ClinicQueryDto extends ListQueryDto {
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
