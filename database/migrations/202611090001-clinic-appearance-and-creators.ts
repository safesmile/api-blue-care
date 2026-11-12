import type { QueryInterface } from "sequelize";

export = {
  async up(q: QueryInterface) {
    await q.sequelize.transaction(async transaction => {
      await q.sequelize.query(
        `ALTER TABLE clinics
          ADD COLUMN icon VARCHAR(20) NOT NULL DEFAULT 'clinic'
            CHECK (icon IN ('clinic','cross','pin','star','grid','layers')),
          ADD COLUMN color VARCHAR(20) NOT NULL DEFAULT 'teal'
            CHECK (color IN ('teal','blue','violet','rose','amber','slate'))`,
        { transaction }
      );
      await q.sequelize.query(
        `WITH assigned AS (
          INSERT INTO clinic_staff ("clinicId","userId","createdAt")
          SELECT c.id,u.id,NOW()
          FROM clinics c
          JOIN audit_events a ON a."resourceType"='clinic' AND a."resourceId"=c.id::text AND a.action='clinic.created'
          JOIN users u ON u.id=a."actorId" AND u.enabled
          WHERE c.enabled
          AND 2=(SELECT COUNT(DISTINCT rp."permissionCode")
            FROM user_roles ur JOIN role_permissions rp ON rp."roleId"=ur."roleId"
            WHERE ur."userId"=u.id AND ur."clinicId" IS NULL AND rp."permissionCode" IN ('clinics:create','clinics:all'))
          AND NOT EXISTS (
            SELECT 1 FROM audit_events r
            WHERE r."resourceType"='clinic' AND r."resourceId"=c.id::text AND r.action='clinic.staff-unassigned'
            AND r."before"->>'userId'=u.id::text)
          ON CONFLICT DO NOTHING RETURNING "clinicId","userId"
        ), history AS (
          INSERT INTO audit_events
            (id,"occurredAt","requestId","actorType",action,"resourceType","resourceId","after")
          SELECT gen_random_uuid(),NOW(),gen_random_uuid(),'system','clinic.staff-assigned','clinic',s."clinicId"::text,
            jsonb_build_object('userId',s."userId",'roles',jsonb_build_array())
          FROM assigned s RETURNING id,"resourceId","after"
        )
        INSERT INTO notifications (id,"userId","eventKey",title,body,"createdAt","visibleAt")
        SELECT gen_random_uuid(),CAST(h."after"->>'userId' AS UUID),'event:' || h.id || ':' || (h."after"->>'userId'),
          :title,:prefix || c.name || :suffix,
          NOW(),NOW()
        FROM history h JOIN clinics c ON c.id::text=h."resourceId"`,
        {
          transaction,
          replacements: {
            title: "Acceso a una clínica",
            prefix: "Ya tienes acceso a ",
            suffix: ". Consulta tus clínicas disponibles en Blue Care."
          }
        }
      );
    });
  },
  async down(q: QueryInterface) {
    await q.sequelize.query("ALTER TABLE clinics DROP COLUMN icon, DROP COLUMN color");
  }
};
