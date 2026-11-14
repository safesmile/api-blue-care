import type { QueryInterface } from "sequelize";

export = {
  async up(q: QueryInterface) {
    await q.sequelize.transaction(async transaction => {
      await q.sequelize.query(
        `CREATE OR REPLACE FUNCTION blue_care_immutable_history() RETURNS trigger LANGUAGE PLPGSQL AS $$ BEGIN
        IF TG_OP='UPDATE' AND TG_TABLE_NAME='plan_versions' THEN
          IF OLD."publishedAt" IS NULL AND NEW."publishedAt" IS NULL
            AND (OLD.id, OLD."planId", OLD.number, OLD."createdAt")
              IS NOT DISTINCT FROM (NEW.id, NEW."planId", NEW.number, NEW."createdAt") AND OLD.currency=NEW.currency
          THEN RETURN NEW; END IF;
        END IF;
        IF TG_OP='UPDATE' AND TG_TABLE_NAME='plan_versions' AND OLD."publishedAt" IS NULL AND NEW."publishedAt" IS NOT NULL
        AND (TO_JSONB(OLD)-'publishedAt')=(TO_JSONB(NEW)-'publishedAt') THEN RETURN NEW; END IF;
        RAISE EXCEPTION 'Commercial history is immutable'; END; $$`,
        { transaction }
      );
      await q.sequelize.query(
        `CREATE OR REPLACE FUNCTION blue_care_benefit_history() RETURNS trigger LANGUAGE PLPGSQL AS $$ BEGIN
        IF TG_OP='UPDATE' AND TG_TABLE_NAME='benefit_versions' THEN
          IF OLD."publishedAt" IS NULL AND NEW."publishedAt" IS NULL
            AND (OLD.id, OLD."benefitId", OLD.number, OLD."createdAt")
              IS NOT DISTINCT FROM (NEW.id, NEW."benefitId", NEW.number, NEW."createdAt")
          THEN RETURN NEW; END IF;
        END IF;
        IF TG_OP='UPDATE' AND TG_TABLE_NAME='benefit_versions' AND OLD."publishedAt" IS NULL AND NEW."publishedAt" IS NOT NULL
        AND (TO_JSONB(OLD)-'publishedAt')=(TO_JSONB(NEW)-'publishedAt') THEN RETURN NEW; END IF;
        RAISE EXCEPTION 'Benefit history is immutable'; END; $$`,
        { transaction }
      );
    });
  },
  async down(q: QueryInterface) {
    await q.sequelize.transaction(async transaction => {
      await q.sequelize.query(
        `CREATE OR REPLACE FUNCTION blue_care_immutable_history() RETURNS trigger LANGUAGE PLPGSQL AS $$ BEGIN
        IF TG_OP='UPDATE' AND TG_TABLE_NAME='plan_versions' AND OLD."publishedAt" IS NULL AND NEW."publishedAt" IS NOT NULL
        AND (TO_JSONB(OLD)-'publishedAt')=(TO_JSONB(NEW)-'publishedAt') THEN RETURN NEW; END IF;
        RAISE EXCEPTION 'Commercial history is immutable'; END; $$`,
        { transaction }
      );
      await q.sequelize.query(
        `CREATE OR REPLACE FUNCTION blue_care_benefit_history() RETURNS trigger LANGUAGE PLPGSQL AS $$ BEGIN
        IF TG_OP='UPDATE' AND TG_TABLE_NAME='benefit_versions' AND OLD."publishedAt" IS NULL AND NEW."publishedAt" IS NOT NULL
        AND (TO_JSONB(OLD)-'publishedAt')=(TO_JSONB(NEW)-'publishedAt') THEN RETURN NEW; END IF;
        RAISE EXCEPTION 'Benefit history is immutable'; END; $$`,
        { transaction }
      );
    });
  }
};
