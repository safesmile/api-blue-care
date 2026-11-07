import type { ClinicContextRepository } from "../../modules/authorization/domain/clinic-context.repository";
/**
 * Isolates context resolution; database scope enforcement is tested in integration.
 * @returns A context resolver using the supplied unit-test identity.
 */
export function clinicContextFixture(): jest.Mocked<ClinicContextRepository> {
  return {
    resolve: jest.fn(async (user, clinicId, _strict, mode = "staff") => {
      void _strict;
      return {
        ...user,
        clinicId,
        mode,
        globalRoles: user.roles,
        globalPermissions: user.permissions,
        clinics: clinicId ? [{ id: clinicId, name: "Fixture clinic", roles: [], permissions: [] }] : []
      };
    })
  };
}
