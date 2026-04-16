import { DataTypes, Model, Sequelize } from "sequelize";

export interface UserAttributes {
  id: string;
  firebaseUid: string | null;
  email: string;
  phone: string | null;
  displayName: string;
  provider: "google" | "internal";
  passwordHash: string | null;
  role: "INDIVIDUAL" | "RECRUITER" | "EMPLOYER" | "ADMIN";
  status: "active" | "inactive" | "pending" | "suspended";
  avatarUrl: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class User extends Model<UserAttributes> implements UserAttributes {
  declare id: string;
  declare firebaseUid: string | null;
  declare email: string;
  declare phone: string | null;
  declare displayName: string;
  declare provider: "google" | "internal";
  declare passwordHash: string | null;
  declare role: "INDIVIDUAL" | "RECRUITER" | "EMPLOYER" | "ADMIN";
  declare status: "active" | "inactive" | "pending" | "suspended";
  declare avatarUrl: string | null;
  declare lastLoginAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export interface RoleRequestAttributes {
  id: string;
  userId: string;
  requestedRole: string;
  companyName: string;
  companyWebsite: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class RoleRequest extends Model<RoleRequestAttributes> implements RoleRequestAttributes {
  declare id: string;
  declare userId: string;
  declare requestedRole: string;
  declare companyName: string;
  declare companyWebsite: string;
  declare reason: string;
  declare status: "pending" | "approved" | "rejected";
  declare reviewedBy: string | null;
  declare reviewedAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initUserModel(sequelize: Sequelize): void {
  User.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      firebaseUid: {
        type: DataTypes.STRING(128),
        unique: true,
        allowNull: true,
        field: "firebase_uid",
      },
      email: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      displayName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "display_name",
      },
      provider: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "google",
        validate: {
          isIn: [["google", "internal"]],
        },
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "password_hash",
      },
      role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "INDIVIDUAL",
        validate: {
          isIn: [["INDIVIDUAL", "RECRUITER", "EMPLOYER", "ADMIN"]],
        },
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "active",
        validate: {
          isIn: [["active", "inactive", "pending", "suspended"]],
        },
      },
      avatarUrl: {
        type: DataTypes.STRING(512),
        allowNull: true,
        field: "avatar_url",
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "last_login_at",
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
      tableName: "users",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );
}

export function initRoleRequestModel(sequelize: Sequelize): void {
  RoleRequest.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "user_id",
        references: {
          model: "users",
          key: "id",
        },
      },
      requestedRole: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: "requested_role",
        validate: {
          isIn: [["EMPLOYER", "RECRUITER"]],
        },
      },
      companyName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "company_name",
      },
      companyWebsite: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "company_website",
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "pending",
        validate: {
          isIn: [["pending", "approved", "rejected"]],
        },
      },
      reviewedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: "reviewed_by",
        references: {
          model: "users",
          key: "id",
        },
      },
      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "reviewed_at",
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
      tableName: "role_requests",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );
}
