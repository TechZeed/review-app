import { OrganizationRepository, ProfileOrgRepository } from './organization.repo.js';
import { CreateOrgInput, TagInput, OrgMemberStatus } from './organization.types.js';
import { AppError } from '../../shared/errors/appError.js';

export class OrganizationService {
  constructor(
    private orgRepo: OrganizationRepository,
    private profileOrgRepo: ProfileOrgRepository,
  ) {}

  async createOrg(userId: string, data: CreateOrgInput) {
    const existing = await this.orgRepo.findByName(data.name);
    if (existing) {
      throw new AppError('Organization already exists', 409, 'ORGANIZATION_ALREADY_EXISTS');
    }

    return this.orgRepo.create({
      ...data,
      location: JSON.stringify(data.location),
      createdByUserId: userId,
    });
  }

  async getOrgById(id: string) {
    const org = await this.orgRepo.findById(id);
    if (!org) {
      throw new AppError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
    }
    return org;
  }

  async tagProfile(userId: string, data: TagInput) {
    const { profileId, organizationId, role } = data;

    if (!profileId || !organizationId) {
      throw new AppError(
        'Both profileId and organizationId are required',
        400,
        'VALIDATION_ERROR',
      );
    }

    // Check if tag already exists
    const existing = await this.profileOrgRepo.findByProfileAndOrg(profileId, organizationId);
    if (existing) {
      throw new AppError('Tag already exists', 409, 'TAG_ALREADY_EXISTS');
    }

    return this.profileOrgRepo.create({
      profileId,
      organizationId,
      title: role,
      startDate: new Date(),
      status: OrgMemberStatus.ACTIVE,
      taggedByUserId: userId,
    });
  }

  async untagProfile(profileOrgId: string, userId: string) {
    const tag = await this.profileOrgRepo.findById(profileOrgId);
    if (!tag) {
      throw new AppError('Tag not found', 404, 'TAG_NOT_FOUND');
    }

    // Set endDate and mark as former instead of deleting
    // This preserves the association history while reviews remain intact
    await this.profileOrgRepo.update(profileOrgId, {
      endDate: new Date(),
      status: OrgMemberStatus.FORMER,
    });

    return { message: 'Organization untagged successfully', reviewsRetained: true };
  }

  async getProfileOrgs(profileId: string) {
    return this.profileOrgRepo.findByProfile(profileId);
  }

  async getOrgMembers(orgId: string) {
    return this.profileOrgRepo.findActiveByOrg(orgId);
  }

  async getTeamCount(orgId: string): Promise<number> {
    return this.profileOrgRepo.countActiveByOrg(orgId);
  }
}
