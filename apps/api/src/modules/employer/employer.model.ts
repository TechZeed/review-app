import { DataTypes, Model, Sequelize } from "sequelize";

export interface FraudFlagAttributes {
  id: string;
  reviewId: string;
  flagType: string;
  confidenceScore: number;
  details: Record<string, any>;
  resolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
}

export class FraudFlag extends Model<FraudFlagAttributes> implements FraudFlagAttributes {
  declare id: string;
  declare reviewId: string;
  declare flagType: string;
  declare confidenceScore: number;
  declare details: Record<string, any>;
  declare resolved: boolean;
  declare resolvedAt: Date | null;
  declare createdAt: Date;
}

export function initFraudFlagModel(sequelize: Sequelize): void {
  FraudFlag.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      reviewId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "reviews",
          key: "id",
        },
        onDelete: "CASCADE",
        field: "review_id",
      },
      flagType: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: "flag_type",
        comment: "velocity_spike, device_clustering, location_clustering, quality_pattern, text_similarity, timing_pattern, cross_individual",
      },
      confidenceScore: {
        type: DataTypes.FLOAT,
        allowNull: false,
        field: "confidence_score",
        comment: "0.0-1.0 confidence that the flag is valid",
      },
      details: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: "Contextual data: triggering signals, thresholds exceeded, related review IDs",
      },
      resolved: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      resolvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "resolved_at",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "created_at",
      },
    },
    {
      sequelize,
      tableName: "fraud_flags",
      timestamps: false,
    },
  );
}
