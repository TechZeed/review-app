import { DataTypes, Model, Sequelize } from "sequelize";

export interface SubscriptionAttributes {
  id: string;
  userId: string;
  tier: "free" | "pro" | "employer" | "recruiter";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  billingCycle: "monthly" | "annual" | null;
  quantity: number;
  status: "active" | "past_due" | "cancelled" | "trialing" | "incomplete";
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Subscription extends Model<SubscriptionAttributes> implements SubscriptionAttributes {
  declare id: string;
  declare userId: string;
  declare tier: "free" | "pro" | "employer" | "recruiter";
  declare stripeCustomerId: string | null;
  declare stripeSubscriptionId: string | null;
  declare stripePriceId: string | null;
  declare billingCycle: "monthly" | "annual" | null;
  declare quantity: number;
  declare status: "active" | "past_due" | "cancelled" | "trialing" | "incomplete";
  declare currentPeriodStart: Date | null;
  declare currentPeriodEnd: Date | null;
  declare cancelAtPeriodEnd: boolean;
  declare cancelledAt: Date | null;
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
      stripePriceId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "stripe_price_id",
      },
      billingCycle: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: "billing_cycle",
        validate: {
          isIn: [["monthly", "annual"]],
        },
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
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
      cancelAtPeriodEnd: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "cancel_at_period_end",
      },
      cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "cancelled_at",
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
