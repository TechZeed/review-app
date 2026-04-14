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

  // review_tokens must exist before reviews (FK dependency)
  await queryInterface.createTable("review_tokens", {
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
    token_hash: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
    },
    device_fingerprint_hash: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    scanned_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    is_used: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    phone_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await safeAddIndex(queryInterface, "review_tokens", ["token_hash"], { name: "review_tokens_token_hash_unique", unique: true });
  await safeAddIndex(queryInterface, "review_tokens", ["profile_id"], { name: "review_tokens_profile_id_idx" });
  await safeAddIndex(queryInterface, "review_tokens", ["expires_at"], { name: "review_tokens_expires_at_idx" });
  await safeAddIndex(queryInterface, "review_tokens", ["is_used"], { name: "review_tokens_is_used_idx" });

  // reviews
  await queryInterface.createTable("reviews", {
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
    reviewer_phone_hash: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    quality_picks: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    device_fingerprint_hash: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    location_lat: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    location_lng: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    review_token_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "review_tokens", key: "id" },
      onDelete: "SET NULL",
    },
    is_verified_interaction: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    fraud_score: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.0,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await safeAddIndex(queryInterface, "reviews", ["profile_id"], { name: "reviews_profile_id_idx" });
  await safeAddIndex(queryInterface, "reviews", ["profile_id", "created_at"], { name: "reviews_profile_id_created_at_idx" });
  await safeAddIndex(queryInterface, "reviews", ["reviewer_phone_hash"], { name: "reviews_reviewer_phone_hash_idx" });
  await safeAddIndex(queryInterface, "reviews", ["device_fingerprint_hash"], { name: "reviews_device_fingerprint_hash_idx" });
  await safeAddIndex(queryInterface, "reviews", ["review_token_id"], { name: "reviews_review_token_id_idx" });
  await safeAddIndex(queryInterface, "reviews", ["created_at"], { name: "reviews_created_at_idx" });
  await safeAddIndex(queryInterface, "reviews", ["fraud_score"], { name: "reviews_fraud_score_idx" });
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  await queryInterface.dropTable("reviews");
  await queryInterface.dropTable("review_tokens");
};
