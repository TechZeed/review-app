import { DataTypes, Model, Sequelize } from "sequelize";

export interface SubscriptionAttributes {
  id: string;
  userId: string;
  tier: "free" | "pro" | "employer" | "recruiter";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: "active" | "past_due" | "cancelled" | "trialing" | "incomplete";
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Subscription extends Model<SubscriptionAttributes> implements SubscriptionAttributes {
  declare id: string;
  declare userId: string;
  declare tier: "free" | "pro" | "employer" | "recruiter";
  declare stripeCustomerId: string | null;
  declare stripeSubscriptionId: string | null;
  declare status: "active" | "past_due" | "cancelled" | "trialing" | "incomplete";
  declare currentPeriodStart: Date | null;
  declare currentPeriodEnd: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initSubscriptionModel(sequelize: Sequelize): void {
  Subscription.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        field: "user_id",
      },
      tier: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "free",
        validate: {
          isIn: [["free", "pro", "employer", "recruiter"]],
        },
      },
      stripeCustomerId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "stripe_customer_id",
      },
      stripeSubscriptionId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
        field: "stripe_subscription_id",
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "active",
        validate: {
          isIn: [["active", "past_due", "cancelled", "trialing", "incomplete"]],
        },
      },
      currentPeriodStart: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "current_period_start",
      },
      currentPeriodEnd: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "current_period_end",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "created_at",
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "updated_at",
      },
    },
    {
      sequelize,
      tableName: "subscriptions",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );
}
