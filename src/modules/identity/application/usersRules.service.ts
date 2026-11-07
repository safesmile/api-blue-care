import { Injectable, NotFoundException } from "@nestjs/common";
import { IdentityRepository } from "../domain/identity.repository";

/** Reglas internas compartidas; no es una fachada de casos de uso. */
@Injectable()
export class UsersRules {
  /**
   * Recibe los puertos de negocio.
   * @param users Puerto tipado.
   */
  constructor(private readonly users: IdentityRepository) {}
  /**
   * Regla interna compartida.
   * @param id Entrada tipada de negocio.
   * @returns Resultado de negocio.
   */
  async requireUser(id: string) {
    const user = await this.users.read(id);
    if (!user) throw new NotFoundException("No se encontró el usuario");
    return user;
  }
}
