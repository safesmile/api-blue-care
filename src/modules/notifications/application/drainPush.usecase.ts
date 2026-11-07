import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PushRepository, PushSender } from "../domain/push.repository";
import { EntityUseCase } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Push. */
@Injectable()
export class DrainPushUseCase extends EntityUseCase<[], Promise<{ sent: number }>> {
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   * @param sender Dependencia tipada de sender.
   * @param config Dependencia tipada de config.
   */
  constructor(
    private readonly repository: PushRepository,
    private readonly sender: PushSender,
    private readonly config: ConfigService
  ) {
    super();
  }
  /**
   *
   * @returns Resultado de la operación.
   */
  protected async perform() {
    let sent = 0;
    if (!this.sender.available()) return { sent };
    const stopAt = Date.now() + 30000;
    for (const id of await this.repository.pending()) {
      if (Date.now() >= stopAt) break;
      const delivery = await this.repository.claim(id);
      if (!delivery) continue;
      let outcome: "sent" | "invalid" | "retry" = "retry";
      try {
        outcome = await this.sender.send(delivery);
      } catch {
        /* The durable retry records a generic transport failure only. */
      }
      await this.repository.finish(delivery, outcome, Number(this.config.get("NOTIFICATION_MAX_ATTEMPTS") || 5));
      if (outcome === "sent") sent++;
    }
    return { sent };
  }
}
