import { Transform } from "class-transformer";
import { IsString, Length, ValidateIf } from "class-validator";
/** Optional administrative explanation; no actor or credential fields are accepted. */
export class AuditReasonDto {
  @ValidateIf((_input, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 500)
  reason?: string;
}
