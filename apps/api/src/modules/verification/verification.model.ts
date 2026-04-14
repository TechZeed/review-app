import { DataTypes, Model, Sequelize } from "sequelize";

export interface ReviewTokenAttributes {
  id: string;
  profileId: string;
  tokenHash: string;
  deviceFingerprintHash: string;
  scannedAt: Date;
  expiresAt: Date;
  isUsed: boolean;
  phoneVerified: boolean;
  createdAt: Date;
}

export class ReviewToken extends Model<ReviewTokenAttributes> implements ReviewTokenAttributes {
  declare id: string;
  declare profileId: string;
  declare tokenHash: string;
  declare deviceFingerprintHash: string;
  declare scannedAt: Date;
  declare expiresAt: Date;
  declare isUsed: boolean;
  declare phoneVerified: boolean;
  declare createdAt: Date;
}

export function initReviewTokenModel(sequelize: Sequelize): void {
  ReviewToken.init(
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
      tokenHash: {
        type: DataTypes.STRING(128),
        unique: true,
        allowNull: false,
        field: "token_hash",
        comment: "SHA-256 hash of the generated token",
      },
      deviceFingerprintHash: {
        type: DataTypes.STRING(128),
        allowNull: false,
        field: "device_fingerprint_hash",
      },
      scannedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "scanned_at",
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "expires_at",
        comment: "48 hours from scanned_at",
      },
      isUsed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_used",
      },
      phoneVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "phone_verified",
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
      tableName: "review_tokens",
      timestamps: false,
    },
  );
}
