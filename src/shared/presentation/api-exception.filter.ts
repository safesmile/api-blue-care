import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";

const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  400: "Los datos de la solicitud no son válidos",
  401: "Debe iniciar sesión con una cuenta válida",
  403: "No tiene permiso para realizar esta operación",
  404: "No se encontró el recurso solicitado",
  405: "Esta operación no está disponible para este recurso",
  409: "La operación tiene un conflicto con el estado actual del recurso",
  410: "El recurso o enlace ya no está disponible",
  413: "La solicitud supera el tamaño permitido",
  429: "Ha realizado demasiadas solicitudes; inténtelo nuevamente más tarde",
  500: "No se pudo completar la operación",
  503: "El servicio no está disponible temporalmente"
};
const FRAMEWORK_MESSAGES = new Set([
  "Bad Request",
  "Unauthorized",
  "Forbidden",
  "Not Found",
  "Method Not Allowed",
  "Conflict",
  "Gone",
  "Internal Server Error",
  "Service Unavailable",
  "ThrottlerException: Too Many Requests"
]);

/** Normaliza los errores HTTP en español sin exponer errores internos ni credenciales. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  /**
   * Devuelve el contrato HTTP de error.
   * @param exception Error capturado por Nest.
   * @param host Contexto de la petición HTTP.
   */
  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const fallback = STATUS_MESSAGES[status] ?? STATUS_MESSAGES[500];
    const response = exception instanceof HttpException ? exception.getResponse() : undefined;
    const value = typeof response === "string" ? response : (response as { message?: unknown } | undefined)?.message;
    const message =
      typeof value === "string" && !FRAMEWORK_MESSAGES.has(value)
        ? value.startsWith("Validation failed") || value.startsWith("Cannot ")
          ? fallback
          : value
        : Array.isArray(value)
          ? value
          : fallback;
    if (!(exception instanceof HttpException)) this.logger.error("Error interno al procesar la solicitud");
    host.switchToHttp().getResponse<Response>().status(status).json({ statusCode: status, message, error: fallback });
  }
}
