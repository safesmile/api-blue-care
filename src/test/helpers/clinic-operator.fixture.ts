import request from "supertest";
/**
 * Assigns a fixture's platform operator explicitly; production never implies assignment from a global role.
 * @param app Isolated Nest application.
 * @param token Fixture access credential.
 * @param clinicId Selected clinic, or null for all authorized assignments.
 */
export async function assignClinicOperator(app, token: string, clinicId: string) {
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { sub: string };
  await request(app.getHttpServer())
    .put("/clinics/" + clinicId + "/staff/" + payload.sub)
    .auth(token, { type: "bearer" })
    .send({ roles: ["admin"] })
    .expect(204);
}
