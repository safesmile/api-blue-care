import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import { type RoleName } from "../../../permissions";
import { Transform, Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  ValidateIf,
  IsString,
  Length,
  Max,
  Min,
  MaxLength,
  Matches
} from "class-validator";

/**
 * Defines and validates the HTTP input fields.
 */
export class CreateUserDto extends AuditReasonDto {
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
  @IsString()
  @Length(8, 72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])\S+$/)
  password!: string;
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @Matches(/^[a-z][a-z0-9-]{1,59}$/, { each: true })
  roles!: RoleName[];
}
/**
 * Defines and validates the HTTP input fields.
 */
export class UpdateUserDto extends AuditReasonDto {
  @ValidateIf((_input, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  firstName?: string;
  @ValidateIf((_input, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  lastName?: string;
  @ValidateIf((_input, value) => value !== undefined) @IsBoolean() enabled?: boolean;
  @ValidateIf((_input, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @Matches(/^[a-z][a-z0-9-]{1,59}$/, { each: true })
  roles?: RoleName[];
}
/**
 * Defines and validates the HTTP input fields.
 */
export class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
}
