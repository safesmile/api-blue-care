import { PaginationDto } from "../../identity/presentation/user.dto";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import { Type, Transform } from "class-transformer";
import {
  IsIn,
  IsBoolean,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsString,
  IsUUID,
  ValidateIf,
  Length,
  Matches,
  MaxLength
} from "class-validator";
import { type RoleName } from "../../../permissions";
/** Shared registered contact for explicit invitation workflows. */
export class InvitationContactDto extends AuditReasonDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  firstName!: string;
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  lastName!: string;
}
/** Patient invitation never accepts staff roles or clinic assignments. */
export class InvitePatientDto extends InvitationContactDto {
  @ValidateIf((_o, value) => value !== undefined) @IsUUID() patientId?: string;
}
/** One clinic and work role, with a server-selected staff account role. */
export class InviteCollaboratorDto extends InvitationContactDto {
  @IsUUID() clinicId!: string;
  @IsString() @MaxLength(60) @Matches(/^[a-z][a-z0-9-]{1,59}$/) role!: string;
}
/** Scope used when looking up delegable clinic roles. */
export class ClinicRoleQueryDto {
  @IsUUID() clinicId!: string;
}
/** Filter invitation history before counting and pagination. */
export class InvitationQueryDto extends PaginationDto {
  @ValidateIf((_o, value) => value !== undefined) @IsIn(["general", "patient", "collaborator"]) kind?:
    "general" | "patient" | "collaborator";
}
/** Explicit roles for each clinic included in the collaborator invitation. */
export class InvitationClinicDto {
  @IsUUID() clinicId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @Matches(/^[a-z][a-z0-9-]{1,59}$/, { each: true })
  roles!: string[];
}
/**
 * Defines and validates the HTTP input fields.
 */
export class CreateInvitationDto extends InvitationContactDto {
  @ValidateIf((_o, value) => value !== undefined) @IsBoolean() staff?: boolean;
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InvitationClinicDto)
  clinicAssignments!: InvitationClinicDto[];
  @ValidateIf((_o, value) => value !== undefined) @IsUUID() patientId?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @Matches(/^[a-z][a-z0-9-]{1,59}$/, { each: true })
  roles!: RoleName[];
}
/**
 * Defines and validates the HTTP input fields.
 */
export class InvitationTokenDto {
  @IsString() @Length(80, 80) @Matches(/^[a-f0-9]+$/) token!: string;
}
/**
 * Defines and validates the HTTP input fields.
 */
export class AcceptInvitationDto extends InvitationTokenDto {
  @IsString() @Length(8, 72) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])\S+$/) password!: string;
}
