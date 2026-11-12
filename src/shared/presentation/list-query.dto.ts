import "reflect-metadata";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

/** Contrato común para listados con paginación, orden y filtros declarados por recurso. */
export class ListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
  @IsOptional() @IsString() @Matches(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/) sortBy?: string;
  @IsOptional() @IsIn(["asc", "desc"]) sortOrder?: "asc" | "desc";
  @IsOptional() @IsString() @MaxLength(6000) filters?: string;
}
