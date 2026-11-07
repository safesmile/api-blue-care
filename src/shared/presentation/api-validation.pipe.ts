import { BadRequestException, ValidationPipe, type ValidationError, type ValidationPipeOptions } from "@nestjs/common";

const CONSTRAINTS: Readonly<Record<string, string>> = {
  whitelistValidation: "no es un campo permitido",
  isDefined: "es obligatorio",
  isNotEmpty: "no puede estar vacío",
  isString: "debe ser un texto",
  isBoolean: "debe ser verdadero o falso",
  isEmail: "debe ser un correo electrónico válido",
  isUuid: "debe ser un identificador UUID válido",
  isInt: "debe ser un número entero",
  isNumber: "debe ser un número",
  isArray: "debe ser una lista",
  arrayNotEmpty: "debe contener al menos un elemento",
  arrayUnique: "no puede contener elementos duplicados",
  isDateString: "debe ser una fecha válida",
  isEnum: "debe contener una opción permitida",
  isIn: "debe contener una opción permitida",
  isObject: "debe ser un objeto",
  isPositive: "debe ser mayor que cero",
  min: "es menor que el mínimo permitido",
  max: "supera el máximo permitido",
  minLength: "no alcanza la longitud mínima permitida",
  maxLength: "supera la longitud máxima permitida",
  arrayMaxSize: "supera la cantidad máxima permitida",
  arrayMinSize: "no alcanza la cantidad mínima permitida",
  matches: "no cumple el formato requerido",
  nestedValidation: "debe contener datos válidos"
};

/** Conserva la validación estricta y devuelve mensajes de validación en español. */
export class ApiValidationPipe extends ValidationPipe {
  /**
   * Recibe las dependencias de la operación.
   * @param options Dependencia tipada de options.
   */
  constructor(options: ValidationPipeOptions = {}) {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      ...options,
      validationError: { target: false, value: false },
      exceptionFactory: errors => new BadRequestException(validationMessages(errors))
    });
  }
}

/**
 * Genera mensajes sin incluir los valores rechazados.
 * @param errors Errores de validación.
 * @param parent Ruta del campo anidado.
 * @returns Lista de mensajes para el usuario.
 */
export function validationMessages(errors: readonly ValidationError[], parent = ""): string[] {
  return errors.flatMap(error => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    return [
      ...Object.keys(error.constraints ?? {}).map(
        rule => `${field}: ${CONSTRAINTS[rule] ?? "contiene un valor no válido"}`
      ),
      ...validationMessages(error.children ?? [], field)
    ];
  });
}
