import { IsIn, IsUUID, ValidateIf } from "class-validator";
import { PaginationDto } from "../../identity/presentation/user.dto";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import type { Cadence } from "../domain/membership.repository";
/** Only the accepted published revision and cadence come from the account owner. */
export class OwnMembershipDto extends AuditReasonDto {
  @IsUUID() planVersionId!: string;
  @IsIn(["monthly", "annual"]) cadence!: Cadence;
}
/** Administrative pending-contract creation still requires patient scope. */
export class CreateMembershipDto extends OwnMembershipDto {
  @IsUUID() patientId!: string;
}
/** Bounded search by an explicit patient identifier. */
export class MembershipQueryDto extends PaginationDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() patientId?: string;
}
