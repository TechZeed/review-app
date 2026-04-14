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

  await queryInterface.createTable("review_media", {
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
    media_type: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    content_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    media_url: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    duration_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    transcription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_moderated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    moderation_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await safeAddIndex(queryInterface, "review_media", ["review_id"], { name: "review_media_review_id_idx" });
  await safeAddIndex(queryInterface, "review_media", ["media_type"], { name: "review_media_media_type_idx" });
  await safeAddIndex(queryInterface, "review_media", ["moderation_status"], { name: "review_media_moderation_status_idx" });
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  await queryInterface.dropTable("review_media");
};
