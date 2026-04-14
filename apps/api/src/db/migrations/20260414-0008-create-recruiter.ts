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

  // recruiter_searches
  await queryInterface.createTable("recruiter_searches", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    recruiter_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    search_query: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    results_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    searched_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await safeAddIndex(queryInterface, "recruiter_searches", ["recruiter_user_id"], { name: "recruiter_searches_recruiter_user_id_idx" });
  await safeAddIndex(queryInterface, "recruiter_searches", ["searched_at"], { name: "recruiter_searches_searched_at_idx" });

  // contact_requests
  await queryInterface.createTable("contact_requests", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    recruiter_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    profile_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "profiles", key: "id" },
      onDelete: "CASCADE",
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
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

  await safeAddIndex(queryInterface, "contact_requests", ["recruiter_user_id"], { name: "contact_requests_recruiter_user_id_idx" });
  await safeAddIndex(queryInterface, "contact_requests", ["profile_id"], { name: "contact_requests_profile_id_idx" });
  await safeAddIndex(queryInterface, "contact_requests", ["status"], { name: "contact_requests_status_idx" });
  await safeAddIndex(queryInterface, "contact_requests", ["recruiter_user_id", "profile_id"], {
    name: "contact_requests_recruiter_profile_unique",
    unique: true,
  });

  // fraud_flags
  await queryInterface.createTable("fraud_flags", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    review_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "reviews", key: "id" },
      onDelete: "CASCADE",
    },
    flag_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    confidence_score: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    resolved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await safeAddIndex(queryInterface, "fraud_flags", ["review_id"], { name: "fraud_flags_review_id_idx" });
  await safeAddIndex(queryInterface, "fraud_flags", ["flag_type"], { name: "fraud_flags_flag_type_idx" });
  await safeAddIndex(queryInterface, "fraud_flags", ["resolved"], { name: "fraud_flags_resolved_idx" });
  await safeAddIndex(queryInterface, "fraud_flags", ["confidence_score"], { name: "fraud_flags_confidence_score_idx" });
  await safeAddIndex(queryInterface, "fraud_flags", ["created_at"], { name: "fraud_flags_created_at_idx" });

  // qualities
  await queryInterface.createTable("qualities", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    label: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    customer_language: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
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

  await safeAddIndex(queryInterface, "qualities", ["name"], { name: "qualities_name_unique", unique: true });

  // quality_scores
  await queryInterface.createTable("quality_scores", {
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
    quality_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "qualities", key: "id" },
      onDelete: "CASCADE",
    },
    pick_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    percentage: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.0,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await safeAddIndex(queryInterface, "quality_scores", ["profile_id"], { name: "quality_scores_profile_id_idx" });
  await safeAddIndex(queryInterface, "quality_scores", ["quality_id"], { name: "quality_scores_quality_id_idx" });
  await safeAddIndex(queryInterface, "quality_scores", ["profile_id", "quality_id"], {
    name: "quality_scores_profile_quality_unique",
    unique: true,
  });
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  await queryInterface.dropTable("quality_scores");
  await queryInterface.dropTable("qualities");
  await queryInterface.dropTable("fraud_flags");
  await queryInterface.dropTable("contact_requests");
  await queryInterface.dropTable("recruiter_searches");
};
