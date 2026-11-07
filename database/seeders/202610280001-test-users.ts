import type { QueryInterface } from "sequelize";
import { hash } from "bcryptjs";
import { QueryTypes } from "sequelize";
import { syncPermissions } from "../../src/modules/authorization/infrastructure/sync-permissions";
const testClinic = {
  id: "00000000-0000-4000-8000-000000000101",
  code: "blue-care-test",
  name: "Clínica Blue Care de prueba"
};
const testUsers = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    role: "superadmin",
    firstName: "Superadmin",
    lastName: "Prueba",
    email: "superadmin@blue-dent.test"
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    role: "admin",
    firstName: "Admin",
    lastName: "Prueba",
    email: "admin@blue-dent.test"
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    role: "customer",
    firstName: "Customer",
    lastName: "Prueba",
    email: "customer@blue-dent.test"
  }
];
export = {
  async up(q: QueryInterface) {
    await syncPermissions(q.sequelize);
    await q.sequelize.transaction(async transaction => {
      await q.sequelize.query("SELECT pg_advisory_xact_lock(hashtext('blue-dent-test-users'))", { transaction });
      const clinics = await q.sequelize.query<{ id: string; code: string }>(
        "SELECT id,code FROM clinics WHERE id=:id OR code=:code FOR UPDATE",
        { replacements: testClinic, type: QueryTypes.SELECT, transaction }
      );
      if (clinics.some(clinic => clinic.id !== testClinic.id || clinic.code !== testClinic.code))
        throw new Error("Test clinic conflicts with an existing clinic");
      await q.sequelize.query(
        `INSERT INTO clinics(id,code,name,enabled,"createdAt","updatedAt")
         VALUES (:id,:code,:name,true,NOW(),NOW()) ON CONFLICT(id) DO NOTHING`,
        { replacements: testClinic, transaction }
      );
      for (const user of testUsers) {
        const collisions = await q.sequelize.query<{ id: string; email: string }>(
          "SELECT id, email FROM users WHERE id = :id OR email = :email FOR UPDATE",
          { replacements: { id: user.id, email: user.email }, type: QueryTypes.SELECT, transaction }
        );
        if (collisions.some(row => row.id !== user.id || row.email !== user.email))
          throw new Error("Test user conflicts with an existing account: " + user.email);
        const [role] = await q.sequelize.query<{ id: string }>("SELECT id FROM roles WHERE name = :name", {
          replacements: { name: user.role },
          type: QueryTypes.SELECT,
          transaction
        });
        if (!role) throw new Error("Missing synchronized role: " + user.role);
        await q.sequelize.query(
          `INSERT INTO users (id,email,name,"firstName","lastName","passwordHash",enabled,verified,"createdAt","updatedAt")
           VALUES (:id,:email,:name,:firstName,:lastName,:passwordHash,true,true,NOW(),NOW())
           ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,"firstName"=EXCLUDED."firstName","lastName"=EXCLUDED."lastName",
           "passwordHash"=EXCLUDED."passwordHash",enabled=true,verified=true,"updatedAt"=NOW()`,
          {
            replacements: {
              ...user,
              name: user.firstName + " " + user.lastName,
              passwordHash: await hash("Pa$$word123", 12)
            },
            transaction
          }
        );
        await q.sequelize.query('DELETE FROM user_roles WHERE "userId" = :id AND "clinicId" IS NULL', {
          replacements: { id: user.id },
          transaction
        });
        await q.sequelize.query('INSERT INTO user_roles ("userId","roleId") VALUES (:id,:roleId)', {
          replacements: { id: user.id, roleId: role.id },
          transaction
        });
        if (user.role !== "customer") {
          const replacements = { id: user.id, clinicId: testClinic.id };
          await q.sequelize.query(
            'INSERT INTO staff_profiles("userId","createdAt") VALUES (:id,NOW()) ON CONFLICT DO NOTHING',
            { replacements, transaction }
          );
          await q.sequelize.query(
            'INSERT INTO clinic_staff("clinicId","userId","createdAt") VALUES (:clinicId,:id,NOW()) ON CONFLICT DO NOTHING',
            { replacements, transaction }
          );
          // superadmin stays global; the shared admin role is valid within a clinic.
          await q.sequelize.query(
            `INSERT INTO user_roles("userId","roleId","clinicId")
             SELECT :id,id,:clinicId FROM roles WHERE name='admin' ON CONFLICT DO NOTHING`,
            { replacements, transaction }
          );
        }
        await q.sequelize.query('DELETE FROM sessions WHERE "userId" = :id', {
          replacements: { id: user.id },
          transaction
        });
      }
    });
  },
  async down(q: QueryInterface) {
    await q.sequelize.transaction(async transaction => {
      await q.sequelize.query("SELECT pg_advisory_xact_lock(hashtext('blue-dent-test-users'))", { transaction });
      for (const user of testUsers)
        await q.sequelize.query("DELETE FROM users WHERE id = :id AND email = :email", {
          replacements: { id: user.id, email: user.email },
          transaction
        });
      // Keep a fixture clinic that has subsequently been used by other records.
      await q.sequelize.query(
        `DELETE FROM clinics c WHERE c.id=:id AND c.code=:code
         AND NOT EXISTS(SELECT 1 FROM clinic_staff s WHERE s."clinicId"=c.id)
         AND NOT EXISTS(SELECT 1 FROM user_roles r WHERE r."clinicId"=c.id)
         AND NOT EXISTS(SELECT 1 FROM sessions s WHERE s."clinicId"=c.id)
         AND NOT EXISTS(SELECT 1 FROM patient_clinics p WHERE p."clinicId"=c.id)
         AND NOT EXISTS(SELECT 1 FROM preventive_events p WHERE p."clinicId"=c.id)
         AND NOT EXISTS(SELECT 1 FROM benefit_consumptions b WHERE b."clinicId"=c.id)`,
        { replacements: testClinic, transaction }
      );
    });
  }
};
