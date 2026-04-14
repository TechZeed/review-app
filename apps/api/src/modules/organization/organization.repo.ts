import { Op } from 'sequelize';
import { BaseRepo } from '../../shared/db/base.repo.js';

// These model types will be provided by the model files when they are created.
// For now we use `any` to allow the repo to be structurally complete.
type Organization = any;
type ProfileOrganization = any;

export class OrganizationRepository extends BaseRepo<Organization> {
  constructor(model: any) {
    super(model);
  }

  async findByName(name: string): Promise<Organization | null> {
    return this.model.findOne({
      where: { name },
    });
  }

  async findByDomain(domain: string): Promise<Organization | null> {
    return this.model.findOne({
      where: { domain },
    });
  }
}

export class ProfileOrgRepository extends BaseRepo<ProfileOrganization> {
  constructor(model: any) {
    super(model);
  }

  async findByProfile(profileId: string): Promise<ProfileOrganization[]> {
    return this.model.findAll({
      where: { profileId },
      order: [['createdAt', 'DESC']],
    });
  }

  async findActiveByOrg(orgId: string): Promise<ProfileOrganization[]> {
    return this.model.findAll({
      where: {
        organizationId: orgId,
        status: 'active',
      },
      order: [['createdAt', 'DESC']],
    });
  }

  async findByProfileAndOrg(
    profileId: string,
    orgId: string,
  ): Promise<ProfileOrganization | null> {
    return this.model.findOne({
      where: {
        profileId,
        organizationId: orgId,
        status: 'active',
      },
    });
  }

  async findActiveByProfile(profileId: string): Promise<ProfileOrganization[]> {
    return this.model.findAll({
      where: {
        profileId,
        status: 'active',
      },
      order: [['createdAt', 'DESC']],
    });
  }

  async countActiveByOrg(orgId: string): Promise<number> {
    return this.model.count({
      where: {
        organizationId: orgId,
        status: 'active',
      },
    });
  }
}
