import { DataTypes, Model, Sequelize } from "sequelize";

export interface ProfileAttributes {
  id: string;
  userId: string;
  slug: string;
  headline: string | null;
  bio: string | null;
  industry: string | null;
  location: string | null;
  qrCodeUrl: string | null;
  visibility: "private" | "recruiter_visible" | "public";
  isVerified: boolean;
  totalReviews: number;
  expertiseCount: number;
  careCount: number;
  deliveryCount: number;
  initiativeCount: number;
  trustCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Profile extends Model<ProfileAttributes> implements ProfileAttributes {
  declare id: string;
  declare userId: string;
  declare slug: string;
  declare headline: string | null;
  declare bio: string | null;
  declare industry: string | null;
  declare location: string | null;
  declare qrCodeUrl: string | null;
  declare visibility: "private" | "recruiter_visible" | "public";
  declare isVerified: boolean;
  declare totalReviews: number;
  declare expertiseCount: number;
  declare careCount: number;
  declare deliveryCount: number;
  declare initiativeCount: number;
  declare trustCount: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initProfileModel(sequelize: Sequelize): void {
  Profile.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        field: "user_id",
      },
      slug: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
        comment: "URL-safe identifier for QR code URLs",
      },
      headline: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      bio: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      industry: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      location: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      qrCodeUrl: {
        type: DataTypes.STRING(512),
        allowNull: true,
        field: "qr_code_url",
      },
      visibility: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "private",
        validate: {
          isIn: [["private", "recruiter_visible", "public"]],
        },
      },
      isVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_verified",
      },
      totalReviews: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "total_reviews",
      },
      expertiseCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "expertise_count",
      },
      careCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "care_count",
      },
      deliveryCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "delivery_count",
      },
      initiativeCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "initiative_count",
      },
      trustCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "trust_count",
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
      tableName: "profiles",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );
}
