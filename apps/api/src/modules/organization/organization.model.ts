import { DataTypes, Model, Sequelize } from "sequelize";

// ─── Organization ──────────────────────────────────────────────────────────────

export interface OrganizationAttributes {
  id: string;
  name: string;
  industry: string | null;
  location: string | null;
  logoUrl: string | null;
  website: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Organization extends Model<OrganizationAttributes> implements OrganizationAttributes {
  declare id: string;
  declare name: string;
  declare industry: string | null;
  declare location: string | null;
  declare logoUrl: string | null;
  declare website: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initOrganizationModel(sequelize: Sequelize): void {
  Organization.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      industry: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      location: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      logoUrl: {
        type: DataTypes.STRING(512),
        allowNull: true,
        field: "logo_url",
      },
      website: {
        type: DataTypes.STRING(512),
        allowNull: true,
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
      tableName: "organizations",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );
}

// ─── ProfileOrganization ───────────────────────────────────────────────────────

export interface ProfileOrganizationAttributes {
  id: string;
  profileId: string;
  organizationId: string;
  roleTitle: string | null;
  isCurrent: boolean;
  taggedAt: Date;
  untaggedAt: Date | null;
}

export class ProfileOrganization extends Model<ProfileOrganizationAttributes> implements ProfileOrganizationAttributes {
  declare id: string;
  declare profileId: string;
  declare organizationId: string;
  declare roleTitle: string | null;
  declare isCurrent: boolean;
  declare taggedAt: Date;
  declare untaggedAt: Date | null;
}

export function initProfileOrganizationModel(sequelize: Sequelize): void {
  ProfileOrganization.init(
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
      organizationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "organizations",
          key: "id",
        },
        onDelete: "CASCADE",
        field: "organization_id",
      },
      roleTitle: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "role_title",
      },
      isCurrent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "is_current",
      },
      taggedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "tagged_at",
      },
      untaggedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "untagged_at",
      },
    },
    {
      sequelize,
      tableName: "profile_organizations",
      timestamps: false,
    },
  );
}
