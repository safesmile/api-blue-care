import { GoneException, type INestApplication } from "@nestjs/common";
import request from "supertest";
import { InvitationsController } from "../../../modules/auth/presentation/invitations.controller";
import { InvitationsUseCase } from "../../helpers/usecases/InvitationsUseCase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("InvitationsController", () => {
  let app: INestApplication;
  const actor = userFixture().toView();
  const token = "b".repeat(80);
  const id = actor.id;
  const invitations = {
    invitePatient: jest.fn(),
    inviteCollaborator: jest.fn(),
    collaboratorRoles: jest.fn(),
    create: jest.fn(),
    list: jest.fn(),
    preview: jest.fn(),
    accept: jest.fn(),
    resend: jest.fn(),
    revoke: jest.fn()
  };
  beforeAll(async () => {
    app = await controllerApp(InvitationsController, [...InvitationsUseCase.providers(invitations)], actor);
  });
  beforeEach(() => jest.resetAllMocks());
  afterAll(async () => {
    await app.close();
  });
  it("records the real inviter rather than trusting body metadata", async () => {
    const input = {
      email: " INVITED@BLUE.TEST ",
      firstName: " Ana ",
      lastName: " López ",
      roles: ["customer"],
      clinicAssignments: []
    };
    invitations.create.mockResolvedValue({ id });
    await request(app.getHttpServer()).post("/auth/invitations").send(input).expect(201, { id });
    expect(invitations.create).toHaveBeenCalledWith(
      { email: "invited@blue.test", firstName: "Ana", lastName: "López", roles: ["customer"], clinicAssignments: [] },
      actor
    );
  });
  it("rejects unknown roles and forged inviter metadata", async () => {
    await request(app.getHttpServer())
      .post("/auth/invitations")
      .send({ email: "a@blue.test", firstName: "A", lastName: "B", roles: ["invalid"], invitedBy: "someone" })
      .expect(400);
    expect(invitations.create).not.toHaveBeenCalled();
  });
  it("lists invitations using bounded pagination", async () => {
    invitations.list.mockResolvedValue({ items: [], total: 0 });
    await request(app.getHttpServer()).get("/auth/invitations?limit=10&offset=2").expect(200, { items: [], total: 0 });
    expect(invitations.list).toHaveBeenCalledWith({ limit: 10, offset: 2 }, actor);
  });
  it("reads and validates the token from the URL query", async () => {
    invitations.preview.mockResolvedValue({ status: "pending" });
    await request(app.getHttpServer())
      .get("/auth/invitations/by-token")
      .query({ token })
      .expect(200, { status: "pending" });
    expect(invitations.preview).toHaveBeenCalledWith(token);
    await request(app.getHttpServer()).get("/auth/invitations/by-token?token=bad").expect(400);
  });
  it("returns 410 when the token is no longer usable", async () => {
    invitations.preview.mockRejectedValue(new GoneException());
    await request(app.getHttpServer()).get("/auth/invitations/by-token").query({ token }).expect(410);
  });
  it("accepts a password only with the invitation credential", async () => {
    await request(app.getHttpServer())
      .post("/auth/invitations/accept")
      .send({ token, password: "Abcd123!" })
      .expect(204);
    expect(invitations.accept).toHaveBeenCalledWith(token, "Abcd123!");
  });
  it("resends a known UUID with the authenticated actor", async () => {
    invitations.resend.mockResolvedValue({ id });
    await request(app.getHttpServer())
      .post("/auth/invitations/" + id + "/resend")
      .expect(200, { id });
    expect(invitations.resend).toHaveBeenCalledWith(id, actor);
  });
  it("revokes without accepting a caller-selected status", async () => {
    await request(app.getHttpServer())
      .post("/auth/invitations/" + id + "/revoke")
      .expect(204);
    expect(invitations.revoke).toHaveBeenCalledWith(id, actor);
  });
  it("rejects invalid identifiers before resending", async () => {
    await request(app.getHttpServer()).post("/auth/invitations/invalid/resend").expect(400);
    expect(invitations.resend).not.toHaveBeenCalled();
  });
  it("rejects role and account injection during token acceptance", async () => {
    await request(app.getHttpServer())
      .post("/auth/invitations/accept")
      .send({ token, password: "Abcd123!", roles: ["superadmin"], userId: actor.id })
      .expect(400);
    expect(invitations.accept).not.toHaveBeenCalled();
  });
  it("exposes separate contact forms and refuses role or clinic injection into patient invitations", async () => {
    const contact = { email: "patient@blue.test", firstName: "Patient", lastName: "Test" };
    invitations.invitePatient.mockResolvedValue({ id });
    await request(app.getHttpServer()).post("/auth/invitations/patients").send(contact).expect(201, { id });
    expect(invitations.invitePatient).toHaveBeenCalledWith(contact, actor);
    for (const extra of [
      { roles: ["admin"] },
      { staff: true },
      { clinicId: id },
      { kind: "collaborator" },
      { clinicAssignments: [] }
    ])
      await request(app.getHttpServer())
        .post("/auth/invitations/patients")
        .send({ ...contact, ...extra })
        .expect(400);
    const collaborator = { ...contact, clinicId: id, role: "reception" };
    await request(app.getHttpServer()).post("/auth/invitations/collaborators").send(collaborator).expect(201);
    expect(invitations.inviteCollaborator).toHaveBeenCalledWith(collaborator, actor);
    await request(app.getHttpServer()).post("/auth/invitations/collaborators").send(contact).expect(400);
    await request(app.getHttpServer()).get("/auth/invitations/collaborators/roles").query({ clinicId: id }).expect(200);
    expect(invitations.collaboratorRoles).toHaveBeenCalledWith(id, actor);
    await request(app.getHttpServer())
      .get("/auth/invitations/collaborators/roles")
      .query({ clinicId: "invalid" })
      .expect(400);
    await request(app.getHttpServer()).get("/auth/invitations").query({ kind: "patient", limit: 10 }).expect(200);
    expect(invitations.list).toHaveBeenLastCalledWith({ kind: "patient", limit: 10, offset: 0 }, actor);
  });
});
