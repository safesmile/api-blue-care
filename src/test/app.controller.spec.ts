import { AppController } from "../app.controller";
describe("health", () => {
  it("reports liveness", () => {
    expect(new AppController().health()).toEqual({
      status: "ok",
      service: "blue-dent"
    });
  });
});
