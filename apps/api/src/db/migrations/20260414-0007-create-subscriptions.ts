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

  await queryInterface.createTable("subscriptions", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    tier: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "free",
    },
    stripe_customer_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    stripe_subscription_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "active",
    },
    current_period_start: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    current_period_end: {
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

  await safeAddIndex(queryInterface, "subscriptions", ["user_id"], { name: "subscriptions_user_id_idx" });
  await safeAddIndex(queryInterface, "subscriptions", ["stripe_subscription_id"], { name: "subscriptions_stripe_subscription_id_unique", unique: true });
  await safeAddIndex(queryInterface, "subscriptions", ["stripe_customer_id"], { name: "subscriptions_stripe_customer_id_idx" });
  await safeAddIndex(queryInterface, "subscriptions", ["status"], { name: "subscriptions_status_idx" });
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  await queryInterface.dropTable("subscriptions");
};
