import type { Migration } from "../umzug.js";
import { DataTypes } from "sequelize";

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

  // ── ALTER users table: add provider, password_hash columns ──
  // (firebase_uid and avatar_url already exist from the initial migration)

  if (!(await columnExists(queryInterface, "users", "provider"))) {
    await queryInterface.addColumn("users", "provider", {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "google",
    });
  }

  if (!(await columnExists(queryInterface, "users", "password_hash"))) {
    await queryInterface.addColumn("users", "password_hash", {
      type: DataTypes.STRING(255),
      allowNull: true,
    });
  }

  // Make firebase_uid nullable (internal users won't have one)
  await queryInterface.changeColumn("users", "firebase_uid", {
    type: DataTypes.STRING(128),
    allowNull: true,
    unique: true,
  });

  // ── CREATE role_requests table ──
  await queryInterface.createTable("role_requests", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    requested_role: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    company_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    company_website: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    reviewed_at: {
      type: DataTypes.DATE,
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

  // Add indexes for role_requests
  try {
    await queryInterface.addIndex("role_requests", ["user_id"], {
      name: "role_requests_user_id_idx",
    });
  } catch (error: any) {
    if (!error.message?.includes("already exists")) throw error;
  }

  try {
    await queryInterface.addIndex("role_requests", ["status"], {
      name: "role_requests_status_idx",
    });
  } catch (error: any) {
    if (!error.message?.includes("already exists")) throw error;
  }
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();

  await queryInterface.dropTable("role_requests");

  // Revert firebase_uid to NOT NULL
  await queryInterface.changeColumn("users", "firebase_uid", {
    type: DataTypes.STRING(128),
    allowNull: false,
    unique: true,
  });

  if (await columnExists(queryInterface, "users", "provider")) {
    await queryInterface.removeColumn("users", "provider");
  }

  if (await columnExists(queryInterface, "users", "password_hash")) {
    await queryInterface.removeColumn("users", "password_hash");
  }
};
