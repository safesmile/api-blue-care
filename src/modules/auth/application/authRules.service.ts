import { type SessionMode } from "../../authorization/domain/clinic-context.repository";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { type Session } from "../domain/session.repository";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
/** Reglas internas compartidas; no es una fachada de casos de uso. */
@Injectable()
export class AuthRules {
  /**
   * Recibe los puertos de negocio.
   * @param jwt Puerto tipado.
   * @param config Puerto tipado.
   */
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}
  /**
   * Regla interna compartida.
   * @param userId Entrada tipada de negocio.
   * @param absoluteExpiresAt Entrada tipada de negocio.
   * @param clinicId Entrada tipada de negocio.
   * @param mode Entrada tipada de negocio.
   * @returns Resultado de negocio.
   */
  async issue(
    userId: string,
    absoluteExpiresAt = new Date(Date.now() + Number(this.config.getOrThrow("SESSION_MAX_SECONDS")) * 1000),
    clinicId: string | null = null,
    mode: SessionMode = "staff"
  ) {
    const refreshToken = randomBytes(40).toString("hex");
    const session: Session = {
      id: randomUUID(),
      userId,
      mode,
      clinicId,
      tokenHash: digest(refreshToken),
      expiresAt: new Date(
        Math.min(
          Date.now() + Number(this.config.getOrThrow("REFRESH_TOKEN_SECONDS")) * 1000,
          absoluteExpiresAt.getTime()
        )
      ),
      absoluteExpiresAt,
      revoked: false
    };
    const token = await this.jwt.signAsync(
      { sub: userId, sid: session.id, mode, ...(mode === "staff" ? { clinicId } : {}) },
      {
        expiresIn: Number(this.config.getOrThrow("ACCESS_TOKEN_SECONDS")),
        issuer: "blue-dent",
        audience: "blue-dent-api",
        algorithm: "HS256"
      }
    );
    return { token, refreshToken, session };
  }
}
