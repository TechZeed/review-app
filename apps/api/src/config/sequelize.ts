import { Sequelize } from "sequelize";
import { appenv } from "./appenv.js";
import { logger } from "./logger.js";

const isTest = appenv.get("NODE_ENV") === "test";

let _sequelize: Sequelize | null = null;

export function getSequelize(): Sequelize {
  if (!_sequelize) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return _sequelize;
}

function getGcpCloudSqlConnection(): Sequelize {
  const cloudSqlConnectionName = appenv.get("CLOUDSQL_CONNECTION_NAME");
  if (!cloudSqlConnectionName) {
    throw new Error("CLOUDSQL_CONNECTION_NAME required for Cloud Run");
  }
  const host = `/cloudsql/${cloudSqlConnectionName}`;
  logger.info(`Using Cloud SQL Unix socket: ${host}`);

  if (appenv.get("DATABASE_URL")) {
    return new Sequelize(appenv.get("DATABASE_URL")!, {
      logging: false,
      dialect: "postgres",
      dialectOptions: {},
    });
  }

  return new Sequelize(
    appenv.get("POSTGRES_DB"),
    appenv.get("POSTGRES_USER"),
    appenv.get("POSTGRES_PASSWORD"),
    {
      host,
      port: undefined,
      dialect: "postgres",
      logging: false,
      dialectOptions: {},
      define: { schema: "public" },
    },
  );
}

function getPlainSqlConnection(): Sequelize {
  const host = appenv.get("POSTGRES_HOST") || "localhost";
  const port = appenv.getAsNumber("POSTGRES_PORT") ?? 5432;
  logger.info(`Using plain connection to ${host}:${port}`);

  return new Sequelize(
    appenv.get("POSTGRES_DB"),
    appenv.get("POSTGRES_USER"),
    appenv.get("POSTGRES_PASSWORD"),
    {
      host,
      port,
      dialect: "postgres",
      logging: isTest ? false : false,
      dialectOptions: {},
      define: { schema: "public" },
    },
  );
}

export async function initDb(): Promise<void> {
  if (_sequelize) {
    return;
  }

  const isCloudRun = !!appenv.get("K_SERVICE");
  const hostIsSocket = (appenv.get("POSTGRES_HOST") || "").startsWith("/cloudsql");
  if (isCloudRun || hostIsSocket) {
    // Cloud Run or explicit Unix socket path — use socket connection
    if (!appenv.get("CLOUDSQL_CONNECTION_NAME") && hostIsSocket) {
      // Extract connection name from host path for socket mode
      const host = appenv.get("POSTGRES_HOST")!;
      logger.info(`Using Cloud SQL Unix socket: ${host}`);
      _sequelize = new Sequelize(
        appenv.get("POSTGRES_DB"),
        appenv.get("POSTGRES_USER"),
        appenv.get("POSTGRES_PASSWORD"),
        {
          host,
          port: undefined,
          dialect: "postgres",
          logging: false,
          dialectOptions: {},
          define: { schema: "public" },
        },
      );
    } else {
      _sequelize = getGcpCloudSqlConnection();
    }
  } else {
    _sequelize = getPlainSqlConnection();
  }

  logger.info("Connecting to database...");
  await _sequelize.authenticate();
  logger.info("Database connected successfully");

  logger.info("Initializing models...");
  await initAllModels(_sequelize);
  logger.info("Models initialized successfully");
}

async function initAllModels(sequelize: Sequelize): Promise<void> {
  const { initUserModel } = await import("../modules/auth/auth.model.js");
  const { initProfileModel } = await import("../modules/profile/profile.model.js");
  const { initOrganizationModel, initProfileOrganizationModel } = await import("../modules/organization/organization.model.js");
  const { initReviewModel } = await import("../modules/review/review.model.js");
  const { initReviewMediaModel } = await import("../modules/media/media.model.js");
  const { initReviewTokenModel } = await import("../modules/verification/verification.model.js");
  const { initVerifiableReferenceModel, initReferenceRequestModel } = await import("../modules/reference/reference.model.js");
  const { initSubscriptionModel } = await import("../modules/subscription/subscription.model.js");
  const { initRecruiterSearchModel, initContactRequestModel } = await import("../modules/recruiter/recruiter.model.js");
  const { initFraudFlagModel } = await import("../modules/employer/employer.model.js");
  const { initQualityModel, initQualityScoreModel } = await import("../modules/quality/quality.model.js");

  initUserModel(sequelize);
  initProfileModel(sequelize);
  initOrganizationModel(sequelize);
  initProfileOrganizationModel(sequelize);
  initReviewTokenModel(sequelize);
  initReviewModel(sequelize);
  initReviewMediaModel(sequelize);
  initVerifiableReferenceModel(sequelize);
  initReferenceRequestModel(sequelize);
  initSubscriptionModel(sequelize);
  initRecruiterSearchModel(sequelize);
  initContactRequestModel(sequelize);
  initFraudFlagModel(sequelize);
  initQualityModel(sequelize);
  initQualityScoreModel(sequelize);

  await setupAssociations();
}

async function setupAssociations(): Promise<void> {
  const { User } = await import("../modules/auth/auth.model.js");
  const { Profile } = await import("../modules/profile/profile.model.js");
  const { Organization, ProfileOrganization } = await import("../modules/organization/organization.model.js");
  const { Review } = await import("../modules/review/review.model.js");
  const { ReviewMedia } = await import("../modules/media/media.model.js");
  const { ReviewToken } = await import("../modules/verification/verification.model.js");
  const { VerifiableReference, ReferenceRequest } = await import("../modules/reference/reference.model.js");
  const { Subscription } = await import("../modules/subscription/subscription.model.js");
  const { RecruiterSearch, ContactRequest } = await import("../modules/recruiter/recruiter.model.js");
  const { FraudFlag } = await import("../modules/employer/employer.model.js");
  const { Quality, QualityScore } = await import("../modules/quality/quality.model.js");

  // User -> Profile (one-to-one)
  User.hasOne(Profile, { foreignKey: "userId", as: "profile" });
  Profile.belongsTo(User, { foreignKey: "userId", as: "user" });

  // User -> Subscription
  User.hasMany(Subscription, { foreignKey: "userId", as: "subscriptions" });
  Subscription.belongsTo(User, { foreignKey: "userId", as: "user" });

  // User -> RecruiterSearch
  User.hasMany(RecruiterSearch, { foreignKey: "recruiterUserId", as: "recruiterSearches" });
  RecruiterSearch.belongsTo(User, { foreignKey: "recruiterUserId", as: "recruiter" });

  // User -> ReferenceRequest
  User.hasMany(ReferenceRequest, { foreignKey: "requesterUserId", as: "referenceRequests" });
  ReferenceRequest.belongsTo(User, { foreignKey: "requesterUserId", as: "requester" });

  // User -> ContactRequest
  User.hasMany(ContactRequest, { foreignKey: "recruiterUserId", as: "contactRequests" });
  ContactRequest.belongsTo(User, { foreignKey: "recruiterUserId", as: "recruiter" });

  // Profile -> ProfileOrganization
  Profile.hasMany(ProfileOrganization, { foreignKey: "profileId", as: "profileOrganizations" });
  ProfileOrganization.belongsTo(Profile, { foreignKey: "profileId", as: "profile" });

  // Organization -> ProfileOrganization
  Organization.hasMany(ProfileOrganization, { foreignKey: "organizationId", as: "profileOrganizations" });
  ProfileOrganization.belongsTo(Organization, { foreignKey: "organizationId", as: "organization" });

  // Profile -> Review
  Profile.hasMany(Review, { foreignKey: "profileId", as: "reviews" });
  Review.belongsTo(Profile, { foreignKey: "profileId", as: "profile" });

  // Profile -> ReviewToken
  Profile.hasMany(ReviewToken, { foreignKey: "profileId", as: "reviewTokens" });
  ReviewToken.belongsTo(Profile, { foreignKey: "profileId", as: "profile" });

  // Profile -> QualityScore
  Profile.hasMany(QualityScore, { foreignKey: "profileId", as: "qualityScores" });
  QualityScore.belongsTo(Profile, { foreignKey: "profileId", as: "profile" });

  // Quality -> QualityScore
  Quality.hasMany(QualityScore, { foreignKey: "qualityId", as: "scores" });
  QualityScore.belongsTo(Quality, { foreignKey: "qualityId", as: "quality" });

  // Review -> ReviewMedia
  Review.hasMany(ReviewMedia, { foreignKey: "reviewId", as: "media" });
  ReviewMedia.belongsTo(Review, { foreignKey: "reviewId", as: "review" });

  // Review -> ReviewToken (many-to-one)
  Review.belongsTo(ReviewToken, { foreignKey: "reviewTokenId", as: "reviewToken" });

  // Review -> VerifiableReference (one-to-one)
  Review.hasOne(VerifiableReference, { foreignKey: "reviewId", as: "verifiableReference" });
  VerifiableReference.belongsTo(Review, { foreignKey: "reviewId", as: "review" });

  // Review -> FraudFlag
  Review.hasMany(FraudFlag, { foreignKey: "reviewId", as: "fraudFlags" });
  FraudFlag.belongsTo(Review, { foreignKey: "reviewId", as: "review" });

  // VerifiableReference -> ReferenceRequest
  VerifiableReference.hasMany(ReferenceRequest, { foreignKey: "verifiableReferenceId", as: "referenceRequests" });
  ReferenceRequest.belongsTo(VerifiableReference, { foreignKey: "verifiableReferenceId", as: "verifiableReference" });

  // Profile -> ContactRequest
  Profile.hasMany(ContactRequest, { foreignKey: "profileId", as: "contactRequests" });
  ContactRequest.belongsTo(Profile, { foreignKey: "profileId", as: "profile" });
}

export async function shutdownDb(): Promise<void> {
  if (_sequelize) {
    await _sequelize.close();
    _sequelize = null;
  }
}
