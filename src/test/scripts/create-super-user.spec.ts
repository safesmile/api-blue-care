import { collectSuperUserInput, validateSuperUserInput } from "../../../scripts/lib/super-user.cjs";
describe("createSuperUser console input", () => {
  it("normalizes names and email and requests a hidden password twice", async () => {
    const io = {
      ask: jest
        .fn()
        .mockResolvedValueOnce(" Ana ")
        .mockResolvedValueOnce(" López ")
        .mockResolvedValueOnce(" ANA@BLUE.TEST "),
      password: jest.fn().mockResolvedValue("Abcd123!"),
      info: jest.fn()
    };
    const values = await collectSuperUserInput(io);
    expect(values).toEqual({
      firstName: "Ana",
      lastName: "López",
      email: "ana@blue.test",
      password: "Abcd123!"
    });
    expect(io.password).toHaveBeenCalledTimes(2);
    expect(io.info).not.toHaveBeenCalled();
  });
  it("retries invalid identity fields, weak passwords and mismatched confirmation", async () => {
    const io = {
      ask: jest
        .fn()
        .mockResolvedValueOnce("")
        .mockResolvedValueOnce("Ana")
        .mockResolvedValueOnce("")
        .mockResolvedValueOnce("López")
        .mockResolvedValueOnce("invalid")
        .mockResolvedValueOnce("ana@blue.test"),
      password: jest
        .fn()
        .mockResolvedValueOnce("weak")
        .mockResolvedValueOnce("Abcd123!")
        .mockResolvedValueOnce("DifferentPassword123!")
        .mockResolvedValueOnce("Abcd123!")
        .mockResolvedValueOnce("Abcd123!"),
      info: jest.fn()
    };
    const values = await collectSuperUserInput(io);
    expect(values.email).toBe("ana@blue.test");
    expect(io.password).toHaveBeenCalledTimes(5);
    expect(JSON.stringify(io.info.mock.calls)).not.toContain("Abcd123!");
  });
  it.each([
    { firstName: "", lastName: "López", email: "a@blue.test", password: "Abcd123!" },
    { firstName: "Ana", lastName: "López", email: "invalid", password: "Abcd123!" },
    { firstName: "Ana", lastName: "López", email: "a@blue.test", password: "weak" },
    { firstName: "Ana", lastName: "López", email: "a@blue.test", password: "Aa1!" + "é".repeat(35) }
  ])("rejects invalid data before accessing the database", input => {
    expect(() => validateSuperUserInput(input)).toThrow();
  });
  it("accepts exactly eight characters and rejects seven", () => {
    const input = { firstName: "Ana", lastName: "López", email: "a@blue.test" };
    expect(validateSuperUserInput({ ...input, password: "Abcd123!" }).password).toBe("Abcd123!");
    expect(() => validateSuperUserInput({ ...input, password: "Abc123!" })).toThrow("al menos 8");
  });
});
