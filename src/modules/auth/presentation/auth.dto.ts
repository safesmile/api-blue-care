import { IsEmail, IsString, Length, Matches, MaxLength } from "class-validator";
/**
 * Defines and validates the HTTP input fields.
 */
export class LoginDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Length(1, 72) password!: string;
}
/**
 * Defines and validates the HTTP input fields.
 */
export class RefreshDto {
  @IsString() @Length(80, 80) @Matches(/^[a-f0-9]+$/) refreshToken!: string;
}
