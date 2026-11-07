import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { SessionRepository } from "../domain/session.repository";
import { EntityUseCase } from "../../../shared/application/entity.usecase";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
/** Caso de uso específico de Session. */
@Injectable()
export class LogoutSessionUseCase extends EntityUseCase<[refreshToken: string], Promise<void>> {
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param sessions Dependencia tipada de sessions.
   */
  constructor(private readonly sessions: SessionRepository) {
    super();
  }
  /**
   *
   * @param refreshToken Entrada de la operación.
   */
  protected async perform(refreshToken: string) {
    await this.sessions.revoke(digest(refreshToken));
  }
}
