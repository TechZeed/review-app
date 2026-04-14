import { DataTypes, Model, Sequelize } from "sequelize";

// ─── Quality ────────────────────────────────────────────────────────────────────

export interface QualityAttributes {
  id: string;
  name: "expertise" | "care" | "delivery" | "initiative" | "trust";
  label: string;
  description: string;
  customerLanguage: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Quality extends Model<QualityAttributes> implements QualityAttributes {
  declare id: string;
  declare name: "expertise" | "care" | "delivery" | "initiative" | "trust";
  declare label: string;
  declare description: string;
  declare customerLanguage: string;
  declare sortOrder: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initQualityModel(sequelize: Sequelize): void {
  Quality.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: {
        type: DataTypes.STRING(20),
        unique: true,
        allowNull: false,
        validate: {
          isIn: [["expertise", "care", "delivery", "initiative", "trust"]],
        },
      },
      label: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      customerLanguage: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "customer_language",
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "sort_order",
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
      tableName: "qualities",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );
}

// ─── QualityScore ───────────────────────────────────────────────────────────────

export interface QualityScoreAttributes {
  id: string;
  profileId: string;
  qualityId: string;
  pickCount: number;
  percentage: number;
  updatedAt: Date;
}

export class QualityScore extends Model<QualityScoreAttributes> implements QualityScoreAttributes {
  declare id: string;
  declare profileId: string;
  declare qualityId: string;
  declare pickCount: number;
  declare percentage: number;
  declare updatedAt: Date;
}

export function initQualityScoreModel(sequelize: Sequelize): void {
  QualityScore.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      profileId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "profiles",
          key: "id",
        },
        onDelete: "CASCADE",
        field: "profile_id",
      },
      qualityId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "qualities",
          key: "id",
        },
        onDelete: "CASCADE",
        field: "quality_id",
      },
      pickCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "pick_count",
      },
      percentage: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.0,
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
      tableName: "quality_scores",
      timestamps: false,
    },
  );
}
