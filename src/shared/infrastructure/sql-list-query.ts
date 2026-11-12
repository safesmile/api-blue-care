import { BadRequestException } from "@nestjs/common";
import type { Pagination } from "../domain/crud.repository";

const LIST_TIME_ZONE = "America/Guatemala";

type Operator = "contains" | "in" | "dateRange";
interface Field {
  sql: string;
  filter?: Operator;
}

/**
 * Convierte el contrato de listados en predicados PostgreSQL con valores separados.
 * @param query Consulta validada en la entrada HTTP.
 * @param fields Columnas y operadores autorizados explícitamente por el repositorio.
 * @param fallback Orden preexistente del recurso.
 * @param tieBreaker Identificador estable para ordenar filas con el mismo valor.
 * @returns Predicados, parámetros y orden para la consulta de datos y conteo.
 */
export function sqlListQuery(
  query: Pagination,
  fields: Readonly<Record<string, Field>>,
  fallback: string,
  tieBreaker: string
) {
  const error = () => new BadRequestException("El filtro o el orden del listado no es válido");
  const field = (key: unknown) => (typeof key === "string" && Object.hasOwn(fields, key) ? fields[key] : undefined);
  const sort = field(query.sortBy);
  if ((query.sortBy && !sort) || (query.sortOrder && (!sort || !["asc", "desc"].includes(query.sortOrder))))
    throw error();
  const order = sort
    ? `${sort.sql} ${query.sortOrder === "desc" ? "DESC" : "ASC"} NULLS LAST, ${tieBreaker}`
    : fallback;
  const parameters: Record<string, string | string[]> = {};
  const conditions: string[] = [];
  if (query.filters !== undefined) {
    let filters: unknown;
    try {
      filters = JSON.parse(query.filters);
    } catch {
      throw error();
    }
    if (!Array.isArray(filters) || filters.length > 12) throw error();
    const seen = new Set<string>();
    for (const [index, filter] of filters.entries()) {
      if (!filter || typeof filter !== "object" || Array.isArray(filter)) throw error();
      const { field: key, operator, value } = filter as { field: string; operator: Operator; value: unknown };
      const column = field(key);
      if (!column?.filter || column.filter !== operator || seen.has(key)) throw error();
      seen.add(key);
      const parameter = `listFilter${index}`;
      if (operator === "contains") {
        if (typeof value !== "string" || !value.trim() || value.length > 100) throw error();
        parameters[parameter] = "%" + value.trim().replace(/[!%_]/g, "!$&") + "%";
        conditions.push(`${column.sql} ILIKE :${parameter} ESCAPE '!'`);
      } else if (operator === "in") {
        if (
          !Array.isArray(value) ||
          !value.length ||
          value.length > 25 ||
          value.some(item => typeof item !== "string" || !item.length || item.length > 100)
        )
          throw error();
        parameters[parameter] = value as string[];
        conditions.push(`CAST(${column.sql} AS TEXT) IN (:${parameter})`);
      } else {
        if (!value || typeof value !== "object" || Array.isArray(value)) throw error();
        const { from, to } = value as { from?: unknown; to?: unknown };
        if (
          (from === undefined && to === undefined) ||
          (from !== undefined && !calendarDate(from)) ||
          (to !== undefined && !calendarDate(to)) ||
          (typeof from === "string" && typeof to === "string" && from > to)
        )
          throw error();
        if (typeof from === "string") {
          parameters[parameter + "From"] = from;
          conditions.push(
            `${column.sql} >= CAST(:${parameter}From AS date)::timestamp AT TIME ZONE '${LIST_TIME_ZONE}'`
          );
        }
        if (typeof to === "string") {
          parameters[parameter + "To"] = to;
          conditions.push(
            `${column.sql} < (CAST(:${parameter}To AS date) + 1)::timestamp AT TIME ZONE '${LIST_TIME_ZONE}'`
          );
        }
      }
    }
  }
  const predicate = conditions.join(" AND ");
  return {
    conditions,
    parameters,
    order,
    and: predicate ? " AND " + predicate : "",
    where: predicate ? " WHERE " + predicate : ""
  };
}

/**
 * Comprueba fechas de calendario sin aceptar normalizaciones de días inválidos.
 * @param value Valor recibido.
 * @returns Si corresponde a una fecha ISO válida.
 */
function calendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
