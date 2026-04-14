import { DataTypes, Model, Sequelize } from "sequelize";

// ─── VerifiableReference ────────────────────────────────────────────────────────

export interface VerifiableReferenceAttributes {
  id: string;
  reviewId: string;
  reviewerPhoneHash: string;
  isContactable: boolean;
  optedInAt: Date;
  withdrawnAt: Date | null;
  contactCount: number;
}

export class VerifiableReference extends Model<VerifiableReferenceAttributes> implements VerifiableReferenceAttributes {
  declare id: string;
  declare reviewId: string;
  declare reviewerPhoneHash: string;
  declare isContactable: boolean;
  declare optedInAt: Date;
  declare withdrawnAt: Date | null;
  declare contactCount: number;
}

export function initVerifiableReferenceModel(sequelize: Sequelize): void {
  VerifiableReference.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      reviewId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: "reviews",
          key: "id",
        },
        onDelete: "CASCADE",
        field: "review_id",
      },
      reviewerPhoneHash: {
        type: DataTypes.STRING(128),
        allowNull: false,
        field: "reviewer_phone_hash",
      },
      isContactable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "is_contactable",
      },
      optedInAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "opted_in_at",
      },
      withdrawnAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "withdrawn_at",
      },
      contactCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "contact_count",
      },
    },
    {
      sequelize,
      tableName: "verifiable_references",
      timestamps: false,
    },
  );
}

// ─── ReferenceRequest ───────────────────────────────────────────────────────────

export interface ReferenceRequestAttributes {
  id: string;
  verifiableReferenceId: string;
  requesterUserId: string;
  status: "pending" | "approved" | "completed" | "expired";
  requestedAt: Date;
  respondedAt: Date | null;
}

export class ReferenceRequest extends Model<ReferenceRequestAttributes> implements ReferenceRequestAttributes {
  declare id: string;
  declare verifiableReferenceId: string;
  declare requesterUserId: string;
  declare status: "pending" | "approved" | "completed" | "expired";
  declare requestedAt: Date;
  declare respondedAt: Date | null;
}

export function initReferenceRequestModel(sequelize: Sequelize): void {
  ReferenceRequest.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      verifiableReferenceId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "verifiable_references",
          key: "id",
        },
        onDelete: "CASCADE",
        field: "verifiable_reference_id",
      },
      requesterUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        field: "requester_user_id",
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "pending",
        validate: {
          isIn: [["pending", "approved", "completed", "expired"]],
        },
      },
      requestedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "requested_at",
      },
      respondedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "responded_at",
      },
    },
    {
      sequelize,
      tableName: "reference_requests",
      timestamps: false,
    },
  );
}
