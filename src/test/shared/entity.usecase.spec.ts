import { ForbiddenException, MethodNotAllowedException } from "@nestjs/common";
import { CrudEntityUseCase, EntityUseCase, authorizeOperation } from "../../shared/application/entity.usecase";
import { PermissionCode } from "../../shared/domain/permission-code";
import type { AccessActor } from "../../modules/authorization/domain/access-policy";

const actor: AccessActor = {
  id: "owner",
  roles: [],
  permissions: [PermissionCode.UsersRead, PermissionCode.UsersManage]
};

/** Operación aislada con efectos observables para comprobar la autorización central. */
class Probe extends EntityUseCase<[value: string, actor?: AccessActor], string> {
  protected readonly policy = { actorIndex: 1, permissions: [PermissionCode.UsersRead] };
  readonly effect = jest.fn((value: string) => value);
  /**
   * Ejecuta el efecto de negocio.
   * @param value Dato autorizado.
   * @returns Resultado observado.
   */
  protected perform(value: string) {
    return this.effect(value);
  }
}

/** CRUD de prueba con operaciones síncronas y asíncronas. */
class CrudProbe extends CrudEntityUseCase<{
  create: (value: string, actor?: AccessActor) => string;
  read: (value: string, actor?: AccessActor) => Promise<string>;
  list: () => string[];
  update: (value: string) => string;
}> {
  protected readonly asynchronousActions = ["read"];
  protected readonly policies = {
    create: { actorIndex: 1, permissions: [PermissionCode.UsersRead] },
    read: { actorIndex: 1, permissions: [PermissionCode.UsersRead] }
  };
  readonly effect = jest.fn((value: string) => value);
  protected readonly handlers = {
    create: this.effect,
    read: async (value: string) => this.effect(value),
    list: () => ["visible"],
    update: (value: string) => value
  };
}

describe("Bases de aplicación", () => {
  it("deniega antes de ejecutar reglas de negocio y conserva las firmas concretas", () => {
    const service = new Probe();
    expect(() => service.execute("secret")).toThrow(ForbiddenException);
    expect(service.effect).not.toHaveBeenCalled();
    expect(service.execute("visible", actor)).toBe("visible");
  });
  it("comparte las cinco operaciones y rechaza las bajas no implementadas", async () => {
    const service = new CrudProbe();
    expect(() => service.create("secret")).toThrow(ForbiddenException);
    await expect(service.read("secret")).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.effect).not.toHaveBeenCalled();
    expect(service.create("created", actor)).toBe("created");
    await expect(service.read("read", actor)).resolves.toBe("read");
    expect(service.list()).toEqual(["visible"]);
    expect(service.update("updated")).toBe("updated");
    expect(() => (service as unknown as { delete(): void }).delete()).toThrow(MethodNotAllowedException);
  });
  it("distingue propiedad de identidad, permisos administrativos y operaciones personales", () => {
    const owner = { ...actor, permissions: [PermissionCode.UsersRead, PermissionCode.PatientsSelf] };
    const identity = { actorIndex: 1, permissions: [PermissionCode.UsersRead], identity: true, targetIndex: 0 };
    expect(() => authorizeOperation(identity, ["other", owner])).toThrow(ForbiddenException);
    expect(() => authorizeOperation(identity, ["owner", owner])).not.toThrow();
    expect(() => authorizeOperation(identity, ["other", actor])).not.toThrow();
    const own = {
      actorIndex: 0,
      permissions: [PermissionCode.PatientsRead],
      ownIndex: 1,
      ownPermission: PermissionCode.PatientsSelf
    };
    expect(() => authorizeOperation(own, [owner, false])).toThrow(ForbiddenException);
    expect(() => authorizeOperation(own, [owner, true])).not.toThrow();
    expect(() => authorizeOperation(undefined, [])).not.toThrow();
  });
});
