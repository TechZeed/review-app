import { DataTypes, Model, Sequelize } from "sequelize";

// ─── RecruiterSearch ────────────────────────────────────────────────────────────

export interface RecruiterSearchAttributes {
  id: string;
  recruiterUserId: string;
  searchQuery: Record<string, any>;
  resultsCount: number;
  searchedAt: Date;
}

export class RecruiterSearch extends Model<RecruiterSearchAttributes> implements RecruiterSearchAttributes {
  declare id: string;
  declare recruiterUserId: string;
  declare searchQuery: Record<string, any>;
  declare resultsCount: number;
  declare searchedAt: Date;
}

export function initRecruiterSearchModel(sequelize: Sequelize): void {
  RecruiterSearch.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      recruiterUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        field: "recruiter_user_id",
      },
      searchQuery: {
        type: DataTypes.JSONB,
        allowNull: false,
        field: "search_query",
        comment: "Search filters: qualities, industry, location, min_reviews, etc.",
      },
      resultsCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "results_count",
      },
      searchedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "searched_at",
      },
    },
    {
      sequelize,
      tableName: "recruiter_searches",
      timestamps: false,
    },
  );
}

// ─── ContactRequest ─────────────────────────────────────────────────────────────

export interface ContactRequestAttributes {
  id: string;
  recruiterUserId: string;
  profileId: string;
  message: string | null;
  status: "pending" | "accepted" | "declined";
  createdAt: Date;
  updatedAt: Date;
}

export class ContactRequest extends Model<ContactRequestAttributes> implements ContactRequestAttributes {
  declare id: string;
  declare recruiterUserId: string;
  declare profileId: string;
  declare message: string | null;
  declare status: "pending" | "accepted" | "declined";
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initContactRequestModel(sequelize: Sequelize): void {
  ContactRequest.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      recruiterUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        field: "recruiter_user_id",
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
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "pending",
        validate: {
          isIn: [["pending", "accepted", "declined"]],
        },
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
      tableName: "contact_requests",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );
}
