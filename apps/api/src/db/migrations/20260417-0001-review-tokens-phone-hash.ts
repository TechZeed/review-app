import type { Migration } from "../umzug.js";
import { DataTypes } from "sequelize";

// Adds phone_hash to review_tokens so OTP verify can persist the hashed
// phone (sha256(phone + profile_id)) server-side. Reading at submit time
// + at sendOtp-time cooldown check drops the dependency on the client
// round-tripping phoneHash. See docs/specs/21 bug #6.

async function columnExists(queryInterface: any, tableName: string, columnName: string): Promise<boolean> {
  try {
    const tableDesc = await queryInterface.describeTable(tableName);
    return columnName in tableDesc;
  } catch {
    return false;
  }
}

export const up: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();

  if (!(await columnExists(queryInterface, "review_tokens", "phone_hash"))) {
    await queryInterface.addColumn("review_tokens", "phone_hash", {
      type: DataTypes.STRING(128),
      allowNull: true,
    });
  }

  try {
    await queryInterface.addIndex("review_tokens", ["phone_hash"], {
      name: "review_tokens_phone_hash_idx",
    });
  } catch (error: any) {
    if (!error.message?.includes("already exists")) throw error;
  }
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();

  try {
    await queryInterface.removeIndex("review_tokens", "review_tokens_phone_hash_idx");
  } catch { /* already removed */ }

  if (await columnExists(queryInterface, "review_tokens", "phone_hash")) {
    await queryInterface.removeColumn("review_tokens", "phone_hash");
  }
};
