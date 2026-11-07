import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  Logger,
  UnauthorizedException
} from "@nestjs/common";
import { ApiExceptionFilter } from "../../shared/presentation/api-exception.filter";
import { ApiValidationPipe, validationMessages } from "../../shared/presentation/api-validation.pipe";
import { CreatePatientDto } from "../../modules/patients/presentation/patients.dto";

describe("Errores HTTP en español", () => {
  const status = jest.fn(),
    json = jest.fn();
  const host = { switchToHttp: () => ({ getResponse: () => ({ status, json }) }) } as unknown as ArgumentsHost;
  beforeEach(() => {
    status.mockReturnValue({ json });
    json.mockClear();
  });
  it.each([
    [new ForbiddenException(), 403, "No tiene permiso"],
    [new UnauthorizedException(), 401, "Debe iniciar sesión"],
    [new BadRequestException("Validation failed (uuid is expected)"), 400, "Los datos"],
    [new HttpException("Cannot GET /missing", 404), 404, "No se encontró"],
    [new HttpException("ThrottlerException: Too Many Requests", 429), 429, "demasiadas solicitudes"],
    [new BadRequestException("Seleccione una clínica"), 400, "Seleccione una clínica"],
    [new HttpException({}, 499), 499, "No se pudo completar"]
  ])("normaliza el error %# sin cambiar su estado", (exception, code, message) => {
    new ApiExceptionFilter().catch(exception, host);
    expect(status).toHaveBeenLastCalledWith(code);
    expect(json).toHaveBeenLastCalledWith(expect.objectContaining({ message: expect.stringContaining(message) }));
  });
  it("oculta detalles internos y conserva los mensajes de validación", () => {
    const logger = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    new ApiExceptionFilter().catch(new Error("database-password"), host);
    expect(JSON.stringify(json.mock.lastCall)).not.toContain("database-password");
    new ApiExceptionFilter().catch(new BadRequestException(["correo: no es válido"]), host);
    expect(json).toHaveBeenLastCalledWith(expect.objectContaining({ message: ["correo: no es válido"] }));
    logger.mockRestore();
  });
  it("rechaza campos extra y datos inválidos sin incluir valores personales", async () => {
    const pipe = new ApiValidationPipe();
    await expect(
      pipe.transform(
        { firstName: "Ana", lastName: "López", clinicId: "invalid", secret: "private" },
        { type: "body", metatype: CreatePatientDto }
      )
    ).rejects.toMatchObject({
      response: {
        message: expect.arrayContaining([
          "secret: no es un campo permitido",
          "clinicId: debe ser un identificador UUID válido"
        ])
      }
    });
    expect(
      validationMessages([{ property: "family", children: [{ property: "0", constraints: { custom: "private" } }] }])
    ).toEqual(["family.0: contiene un valor no válido"]);
    expect(validationMessages([{ property: "empty" }])).toEqual([]);
  });
});
