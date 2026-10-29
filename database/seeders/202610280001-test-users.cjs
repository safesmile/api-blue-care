require("ts-node").register({ transpileOnly: true });
const { hash } = require("bcryptjs");
const { QueryTypes } = require("sequelize");
const { syncPermissions } = require("../../src/modules/authorization/infrastructure/sync-permissions");
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
module.exports = {
  async up(q) {
    await syncPermissions(q.sequelize);
    await q.sequelize.transaction(async transaction => {
      await q.sequelize.query("SELECT pg_advisory_xact_lock(hashtext('blue-dent-test-users'))", { transaction });
      for (const user of testUsers) {
        const collisions = await q.sequelize.query(
          "SELECT id, email FROM users WHERE id = :id OR email = :email FOR UPDATE",
          { replacements: { id: user.id, email: user.email }, type: QueryTypes.SELECT, transaction }
        );
        if (collisions.some(row => row.id !== user.id || row.email !== user.email))
          throw new Error("Test user conflicts with an existing account: " + user.email);
        const [role] = await q.sequelize.query("SELECT id FROM roles WHERE name = :name", {
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
        await q.sequelize.query('DELETE FROM user_roles WHERE "userId" = :id', {
          replacements: { id: user.id },
          transaction
        });
        await q.sequelize.query('INSERT INTO user_roles ("userId","roleId") VALUES (:id,:roleId)', {
          replacements: { id: user.id, roleId: role.id },
          transaction
        });
        await q.sequelize.query('DELETE FROM sessions WHERE "userId" = :id', {
          replacements: { id: user.id },
          transaction
        });
      }
    });
  },
  async down(q) {
    await q.sequelize.transaction(async transaction => {
      for (const user of testUsers)
        await q.sequelize.query("DELETE FROM users WHERE id = :id AND email = :email", {
          replacements: { id: user.id, email: user.email },
          transaction
        });
    });
  }
};
