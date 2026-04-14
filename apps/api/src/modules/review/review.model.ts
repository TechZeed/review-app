import { DataTypes, Model, Sequelize } from "sequelize";

export type QualityPick = "expertise" | "care" | "delivery" | "initiative" | "trust";

export interface ReviewAttributes {
  id: string;
  profileId: string;
  reviewerPhoneHash: string;
  qualityPicks: QualityPick[];
  deviceFingerprintHash: string;
  locationLat: number | null;
  locationLng: number | null;
  reviewTokenId: string | null;
  isVerifiedInteraction: boolean;
  fraudScore: number;
  createdAt: Date;
}

export class Review extends Model<ReviewAttributes> implements ReviewAttributes {
  declare id: string;
  declare profileId: string;
  declare reviewerPhoneHash: string;
  declare qualityPicks: QualityPick[];
  declare deviceFingerprintHash: string;
  declare locationLat: number | null;
  declare locationLng: number | null;
  declare reviewTokenId: string | null;
  declare isVerifiedInteraction: boolean;
  declare fraudScore: number;
  declare createdAt: Date;
}

export function initReviewModel(sequelize: Sequelize): void {
  Review.init(
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
      reviewerPhoneHash: {
        type: DataTypes.STRING(128),
        allowNull: false,
        field: "reviewer_phone_hash",
        comment: "Salted SHA-256 hash of reviewer phone number",
      },
      qualityPicks: {
        type: DataTypes.JSONB,
        allowNull: false,
        field: "quality_picks",
        comment: "Array of 1-2 quality strings: expertise, care, delivery, initiative, trust",
      },
      deviceFingerprintHash: {
        type: DataTypes.STRING(128),
        allowNull: false,
        field: "device_fingerprint_hash",
        comment: "Composite hash of browser/OS/screen/language",
      },
      locationLat: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        field: "location_lat",
      },
      locationLng: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        field: "location_lng",
      },
      reviewTokenId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "review_tokens",
          key: "id",
        },
        onDelete: "SET NULL",
        field: "review_token_id",
      },
      isVerifiedInteraction: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_verified_interaction",
      },
      fraudScore: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.0,
        field: "fraud_score",
        comment: "0-100 composite fraud risk score; lower is better",
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
      tableName: "reviews",
      timestamps: false,
    },
  );
}
