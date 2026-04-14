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

  // verifiable_references
  await queryInterface.createTable("verifiable_references", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    review_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: { model: "reviews", key: "id" },
      onDelete: "CASCADE",
    },
    reviewer_phone_hash: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    is_contactable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    opted_in_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    withdrawn_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    contact_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  });

  await safeAddIndex(queryInterface, "verifiable_references", ["review_id"], { name: "verifiable_references_review_id_unique", unique: true });
  await safeAddIndex(queryInterface, "verifiable_references", ["reviewer_phone_hash"], { name: "verifiable_references_reviewer_phone_hash_idx" });
  await safeAddIndex(queryInterface, "verifiable_references", ["is_contactable"], { name: "verifiable_references_is_contactable_idx" });

  // reference_requests
  await queryInterface.createTable("reference_requests", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    verifiable_reference_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "verifiable_references", key: "id" },
      onDelete: "CASCADE",
    },
    requester_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
    },
    requested_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    responded_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  await safeAddIndex(queryInterface, "reference_requests", ["verifiable_reference_id"], { name: "reference_requests_verifiable_reference_id_idx" });
  await safeAddIndex(queryInterface, "reference_requests", ["requester_user_id"], { name: "reference_requests_requester_user_id_idx" });
  await safeAddIndex(queryInterface, "reference_requests", ["status"], { name: "reference_requests_status_idx" });
  await safeAddIndex(queryInterface, "reference_requests", ["requester_user_id", "verifiable_reference_id"], {
    name: "reference_requests_requester_ref_unique",
    unique: true,
  });
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  await queryInterface.dropTable("reference_requests");
  await queryInterface.dropTable("verifiable_references");
};
