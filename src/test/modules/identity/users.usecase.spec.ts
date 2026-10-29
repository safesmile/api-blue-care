import { NotFoundException } from "@nestjs/common";
import { UsersUseCase } from "../../../modules/identity/application/users.usecase";
import { identityFixture, userFixture } from "../../helpers/identity.fixture";
describe("UsersUseCase", () => {
  let dependencies: ReturnType<typeof identityFixture>;
  let useCase: UsersUseCase;
  beforeEach(() => {
    dependencies = identityFixture();
    useCase = new UsersUseCase(dependencies.users, dependencies.passwords);
  });
  it("normalizes email, hashes the password and excludes the hash from the result", async () => {
    const result = await useCase.create({
      email: " ADMIN@BLUE.TEST ",
      name: "Admin",
      password: "SecretPassword1!",
      roles: []
    });
    expect(dependencies.passwords.hash).toHaveBeenCalledWith("SecretPassword1!");
    expect(dependencies.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ email: "admin@blue.test", passwordHash: "new-hash", enabled: true })
      })
    );
    expect(result).not.toHaveProperty("passwordHash");
  });
  it("reads a user view", async () => {
    const user = userFixture();
    dependencies.users.read.mockResolvedValue(user);
    expect(await useCase.read(user.id)).toEqual(user.toView());
  });
  it("lists safe views with pagination and total", async () => {
    const user = userFixture();
    dependencies.users.list.mockResolvedValue({ items: [user], total: 8 });
    expect(await useCase.list({ limit: 1, offset: 2 })).toEqual({ items: [user.toView()], total: 8 });
    expect(dependencies.users.list).toHaveBeenCalledWith({ limit: 1, offset: 2 });
  });
  it("updates the permitted properties", async () => {
    const user = userFixture();
    dependencies.users.read.mockResolvedValue(user);
    expect(await useCase.update(user.id, { name: "Dentist", enabled: false, roles: [] })).toMatchObject({
      name: "Dentist",
      enabled: false,
      roles: []
    });
    expect(dependencies.users.update).toHaveBeenCalledWith(user);
  });
  it("deletes an existing user", async () => {
    dependencies.users.read.mockResolvedValue(userFixture());
    await useCase.delete("id");
    expect(dependencies.users.delete).toHaveBeenCalledWith("id");
  });
  it.each(["read", "update", "delete"] as const)("rejects %s for a missing user", async operation => {
    dependencies.users.read.mockResolvedValue(null);
    const result = operation === "update" ? useCase.update("missing", {}) : useCase[operation]("missing");
    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    expect(dependencies.users.update).not.toHaveBeenCalled();
    expect(dependencies.users.delete).not.toHaveBeenCalled();
  });
  it("propagates persistence failures", async () => {
    dependencies.users.list.mockRejectedValue(new Error("database unavailable"));
    await expect(useCase.list({ limit: 25, offset: 0 })).rejects.toThrow("database unavailable");
  });
  it("keeps omitted update fields instead of clearing their role assignments", async () => {
    const user = userFixture();
    dependencies.users.read.mockResolvedValue(user);
    expect(await useCase.update(user.id, { name: undefined, roles: undefined, enabled: undefined })).toEqual(
      user.toView()
    );
    expect(user.props.roles).toEqual(["customer"]);
    expect(user.props.enabled).toBe(true);
  });
});
