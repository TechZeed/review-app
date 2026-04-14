import { DataTypes, Model, Sequelize } from "sequelize";

export interface ReviewMediaAttributes {
  id: string;
  reviewId: string;
  mediaType: "text" | "voice" | "video";
  contentText: string | null;
  mediaUrl: string | null;
  durationSeconds: number | null;
  transcription: string | null;
  isModerated: boolean;
  moderationStatus: "pending" | "approved" | "rejected" | "flagged";
  createdAt: Date;
}

export class ReviewMedia extends Model<ReviewMediaAttributes> implements ReviewMediaAttributes {
  declare id: string;
  declare reviewId: string;
  declare mediaType: "text" | "voice" | "video";
  declare contentText: string | null;
  declare mediaUrl: string | null;
  declare durationSeconds: number | null;
  declare transcription: string | null;
  declare isModerated: boolean;
  declare moderationStatus: "pending" | "approved" | "rejected" | "flagged";
  declare createdAt: Date;
}

export function initReviewMediaModel(sequelize: Sequelize): void {
  ReviewMedia.init(
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
      mediaType: {
        type: DataTypes.STRING(10),
        allowNull: false,
        field: "media_type",
        validate: {
          isIn: [["text", "voice", "video"]],
        },
      },
      contentText: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "content_text",
        comment: "Text content for text reviews (280 char max enforced in app layer)",
      },
      mediaUrl: {
        type: DataTypes.STRING(512),
        allowNull: true,
        field: "media_url",
        comment: "GCS URL for voice/video files",
      },
      durationSeconds: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "duration_seconds",
        comment: "Duration for voice (max 15s) or video (max 30s)",
      },
      transcription: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Server-side auto-transcription of voice/video for search and accessibility",
      },
      isModerated: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_moderated",
      },
      moderationStatus: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "pending",
        field: "moderation_status",
        validate: {
          isIn: [["pending", "approved", "rejected", "flagged"]],
        },
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
      tableName: "review_media",
      timestamps: false,
    },
  );
}
