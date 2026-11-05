import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import { Transform } from "class-transformer";
import { IsArray, ArrayMaxSize, ArrayUnique, IsString, Length, Matches } from "class-validator";
import type { Permission } from "../../../shared/domain/permission";
/** Role names are stable identifiers; permissions must come from the module catalogs. */
export class RoleDto extends AuditReasonDto {
  @IsString() @Length(2, 60) @Matches(/^[a-z][a-z0-9-]*$/) name!: string;
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 255)
  description!: string;
  @IsArray() @ArrayUnique() @ArrayMaxSize(200) @IsString({ each: true }) permissions!: Permission[];
}
