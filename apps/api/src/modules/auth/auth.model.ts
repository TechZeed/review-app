import { DataTypes, Model, Sequelize } from "sequelize";

export interface UserAttributes {
  id: string;
  firebaseUid: string;
  email: string;
  phone: string | null;
  displayName: string;
  role: "INDIVIDUAL" | "RECRUITER" | "EMPLOYER" | "ADMIN";
  status: "active" | "inactive" | "pending" | "suspended";
  avatarUrl: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class User extends Model<UserAttributes> implements UserAttributes {
  declare id: string;
  declare firebaseUid: string;
  declare email: string;
  declare phone: string | null;
  declare displayName: string;
  declare role: "INDIVIDUAL" | "RECRUITER" | "EMPLOYER" | "ADMIN";
  declare status: "active" | "inactive" | "pending" | "suspended";
  declare avatarUrl: string | null;
  declare lastLoginAt: Date | null;
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
        allowNull: false,
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
