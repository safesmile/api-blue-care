import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { UsersUseCase } from "../../../modules/identity/application/users.usecase";
import { identityFixture, userFixture } from "../../helpers/identity.fixture";
import type { RolesRepository } from "../../../modules/authorization/domain/roles.repository";
import { REGISTERED_PERMISSIONS } from "../../../modules/authorization/infrastructure/permission-registry";
describe("UsersUseCase policies and canonical profiles", () => {
  const actor = {
    ...userFixture().toView(),
    roles: ["superadmin"],
    permissions: REGISTERED_PERMISSIONS.map(p => p.shortcode)
  };
  const input = {
    firstName: " Ana ",
    lastName: " López ",
    email: " ANA@BLUE.TEST ",
    password: "Abcd123!",
    roles: ["customer"]
  };
  let deps: ReturnType<typeof identityFixture>, useCase: UsersUseCase;
  const authorizeAssignment = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    deps = identityFixture();
    useCase = new UsersUseCase(deps.users, deps.passwords, { authorizeAssignment } as unknown as RolesRepository);
  });
  it("normalizes both name parts and derives the full name without truncation", async () => {
    const user = await useCase.create(input, actor);
    expect(user).toMatchObject({
      firstName: "Ana",
      lastName: "López",
      name: "Ana López",
      email: "ana@blue.test",
      verified: false
    });
    expect(user).not.toHaveProperty("passwordHash");
    expect(authorizeAssignment).toHaveBeenCalledWith(["customer"], actor);
  });
  it("denies missing actors and permissions, owner scope and protected account mutations", async () => {
    await expect(useCase.create(input)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(useCase.read("other", { ...actor, permissions: [] })).rejects.toBeInstanceOf(ForbiddenException);
    const owner = { ...userFixture().toView(), permissions: ["users:read"] as ["users:read"] };
    await expect(useCase.read("other", owner)).rejects.toBeInstanceOf(ForbiddenException);
    const target = userFixture();
    target.props.roles = ["superadmin"];
    deps.users.read.mockResolvedValue(target);
    const staff = { ...actor, roles: ["reception"] };
    await expect(useCase.update(target.id, {}, staff)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(useCase.delete(target.id, staff)).rejects.toBeInstanceOf(ForbiddenException);
    expect(deps.users.update).not.toHaveBeenCalled();
  });
  it("rejects empty or oversized combined names before persisting", async () => {
    await expect(useCase.create({ ...input, firstName: "" }, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      useCase.create({ ...input, firstName: "a".repeat(60), lastName: "b".repeat(60) }, actor)
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it("reads and lists safe views", async () => {
    const user = userFixture();
    deps.users.read.mockResolvedValue(user);
    deps.users.list.mockResolvedValue({ items: [user], total: 1 });
    expect(await useCase.read(user.id, actor)).toEqual(user.toView());
    expect(await useCase.list({ limit: 25, offset: 0 }, actor)).toEqual({ items: [user.toView()], total: 1 });
    expect(await useCase.read(user.id, { ...user.toView(), permissions: ["users:read"] })).toEqual(user.toView());
  });
  it("updates names atomically and preserves omitted fields and roles", async () => {
    const user = userFixture();
    user.props.lastName = "Example";
    deps.users.read.mockResolvedValue(user);
    expect(await useCase.update(user.id, { firstName: " New " }, actor)).toMatchObject({
      name: "New Example",
      firstName: "New"
    });
    expect(await useCase.update(user.id, { lastName: " Surname " }, actor)).toMatchObject({ name: "New Surname" });
    expect(await useCase.update(user.id, {}, actor)).toMatchObject({ roles: ["customer"], enabled: true });
    expect(deps.users.update).toHaveBeenLastCalledWith(user, actor, false);
    await useCase.update(user.id, { enabled: false, roles: [] }, actor);
    expect(deps.users.update).toHaveBeenLastCalledWith(user, actor, true);
    expect(user.props.enabled).toBe(false);
  });
  it("requires both parts when a historical profile cannot be completed safely", async () => {
    deps.users.read.mockResolvedValue(userFixture());
    await expect(useCase.update(actor.id, { firstName: "New" }, actor)).rejects.toBeInstanceOf(BadRequestException);
  });
  it("deletes and propagates missing records and storage errors", async () => {
    deps.users.read.mockResolvedValue(userFixture());
    await useCase.delete(actor.id, actor);
    expect(deps.users.delete).toHaveBeenCalledWith(actor.id, actor);
    deps.users.read.mockResolvedValue(null);
    await expect(useCase.read("missing", actor)).rejects.toBeInstanceOf(NotFoundException);
    await expect(useCase.update("missing", {}, actor)).rejects.toBeInstanceOf(NotFoundException);
    await expect(useCase.delete("missing", actor)).rejects.toBeInstanceOf(NotFoundException);
    deps.users.list.mockRejectedValue(new Error("unavailable"));
    await expect(useCase.list({ limit: 25, offset: 0 }, actor)).rejects.toThrow("unavailable");
  });
});
