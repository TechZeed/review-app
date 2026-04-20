import type { Migration } from "../umzug.js";
import { DataTypes } from "sequelize";

async function safeAddIndex(queryInterface: any, tableName: string, fields: string[], options: any) {
  try {
    await queryInterface.addIndex(tableName, fields, options);
  } catch (error: any) {
    if (!error.message?.includes("already exists")) throw error;
  }
}

export const up: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();

  await queryInterface.createTable("recruiter_blocks", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    profile_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "profiles", key: "id" },
      onDelete: "CASCADE",
    },
    recruiter_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await safeAddIndex(queryInterface, "recruiter_blocks", ["profile_id", "recruiter_user_id"], {
    name: "recruiter_blocks_profile_recruiter_unique",
    unique: true,
  });
  await safeAddIndex(queryInterface, "recruiter_blocks", ["recruiter_user_id"], {
    name: "recruiter_blocks_recruiter_user_id_idx",
  });
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  await queryInterface.dropTable("recruiter_blocks");
};
