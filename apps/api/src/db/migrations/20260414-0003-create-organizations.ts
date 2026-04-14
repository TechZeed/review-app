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

  // organizations
  await queryInterface.createTable("organizations", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    industry: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    logo_url: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await safeAddIndex(queryInterface, "organizations", ["name"], { name: "organizations_name_idx" });

  // profile_organizations
  await queryInterface.createTable("profile_organizations", {
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
    organization_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "organizations", key: "id" },
      onDelete: "CASCADE",
    },
    role_title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_current: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    tagged_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    untagged_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  await safeAddIndex(queryInterface, "profile_organizations", ["profile_id", "organization_id", "tagged_at"], {
    name: "profile_organizations_profile_org_unique",
    unique: true,
  });
  await safeAddIndex(queryInterface, "profile_organizations", ["profile_id"], { name: "profile_organizations_profile_id_idx" });
  await safeAddIndex(queryInterface, "profile_organizations", ["organization_id"], { name: "profile_organizations_organization_id_idx" });
  await safeAddIndex(queryInterface, "profile_organizations", ["is_current"], { name: "profile_organizations_is_current_idx" });
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  await queryInterface.dropTable("profile_organizations");
  await queryInterface.dropTable("organizations");
};
