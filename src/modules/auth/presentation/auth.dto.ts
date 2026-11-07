import { IsEmail, IsString, IsUUID, ValidateIf, Length, Matches, MaxLength } from "class-validator";
/**
 * Defines and validates the HTTP input fields.
 */
export class LoginDto {
  @ValidateIf((_o, v) => v !== undefined && v !== null) @IsUUID() clinicId?: string | null;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Length(1, 72) password!: string;
}
/**
 * Defines and validates the HTTP input fields.
 */
export class RefreshDto {
  @IsString() @Length(80, 80) @Matches(/^[a-f0-9]+$/) refreshToken!: string;
}

/** Rotates the authenticated session into one clinic or null for all assigned clinics. */
export class SwitchClinicDto extends RefreshDto {
  @ValidateIf((_o, v) => v !== null) @IsUUID() clinicId!: string | null;
}
