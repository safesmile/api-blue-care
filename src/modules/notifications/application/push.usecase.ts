import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AccessPolicy, type AccessActor } from "../../authorization/domain/access-policy";
import { PushRepository, PushSender, type PushDeviceInput } from "../domain/push.repository";
import type { Pagination } from "../../../shared/domain/crud.repository";
/** Coordinates owner registrations and retries without leaking registration tokens. */
@Injectable()
export class PushUseCase {
  /**
   * Receives the explicit persistence and transport dependencies.
   * @param repository Persistence boundary.
   * @param sender Explicit sender value for this operation.
   * @param config Validated environment settings.
   */
  constructor(
    private readonly repository: PushRepository,
    private readonly sender: PushSender,
    private readonly config: ConfigService
  ) {}
  /**
   * Registers the authenticated owner device without returning its token.
   * @param input Validated operation fields.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  register(input: PushDeviceInput, actor: AccessActor) {
    if (!AccessPolicy.allows(actor, "notifications:devices")) throw new ForbiddenException("Missing device permission");
    return this.repository.register(actor.id, input);
  }
  /**
   * Lists bounded records within the current ownership scope.
   * @param page Bounded pagination values.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  list(page: Pagination, actor: AccessActor) {
    if (!AccessPolicy.allows(actor, "notifications:devices")) throw new ForbiddenException("Missing device permission");
    return this.repository.list(actor.id, page);
  }
  /**
   * Disables only a device belonging to the authenticated owner.
   * @param id Resource identifier.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  async remove(id: string, actor: AccessActor) {
    if (!AccessPolicy.allows(actor, "notifications:devices")) throw new ForbiddenException("Missing device permission");
    if (!(await this.repository.remove(actor.id, id))) throw new NotFoundException("Device not found");
  }
  /**
   * Processes a bounded durable batch without external calls in resource transactions.
   * @returns The authorized result or completion of the operation.
   */
  async drain() {
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
