import { ROLE_NAMES, type RoleName } from "../../../permissions";
import { Transform, Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
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
export class CreateUserDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @IsString() @Length(1, 120) name!: string;
  @IsString()
  @Length(8, 72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])\S+$/)
  password!: string;
  @IsArray()
  @ArrayUnique()
  @IsIn(ROLE_NAMES, { each: true })
  roles!: RoleName[];
}
/**
 * Defines and validates the HTTP input fields.
 */
export class UpdateUserDto {
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ROLE_NAMES, { each: true })
  roles?: RoleName[];
}
/**
 * Defines and validates the HTTP input fields.
 */
export class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
}
