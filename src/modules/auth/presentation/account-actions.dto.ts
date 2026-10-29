import { IsEmail, IsString, Length, Matches, MaxLength } from "class-validator";
/**
 * Defines and validates the HTTP input fields.
 */
export class EmailDto {
  @IsEmail() @MaxLength(254) email!: string;
}
/**
 * Defines and validates the HTTP input fields.
 */
export class TokenDto {
  @IsString() @Length(80, 80) @Matches(/^[a-f0-9]+$/) token!: string;
}
/**
 * Defines and validates the HTTP input fields.
 */
export class RedeemDto extends TokenDto {
  @IsString() @Length(8, 72) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])\S+$/) password!: string;
}
/**
 * Defines and validates the HTTP input fields.
 */
export class ChangePasswordDto {
  @IsString() @Length(1, 72) currentPassword!: string;
  @IsString() @Length(8, 72) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])\S+$/) newPassword!: string;
}
/**
 * Defines and validates the HTTP input fields.
 */
export class ChangeEmailDto extends EmailDto {
  @IsString() @Length(1, 72) currentPassword!: string;
}
