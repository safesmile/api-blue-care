import { IsISO8601, IsString, IsUUID, Matches, MaxLength, ValidateIf } from "class-validator";
import { PaginationDto } from "../../identity/presentation/user.dto";
/** Bounded, whitelisted audit filters; unknown query fields are rejected globally. */
export class AuditQueryDto extends PaginationDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() actorId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsString() @Matches(/^[a-z][a-z0-9.-]{1,99}$/) action?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsString() @Matches(/^[a-z][a-z0-9-]{0,59}$/) resourceType?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsString() @MaxLength(100) resourceId?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  from?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  to?: string;
}
