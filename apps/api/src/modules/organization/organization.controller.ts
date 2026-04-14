import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate.js';
import { OrganizationService } from './organization.service.js';
import { OrganizationRepository, ProfileOrgRepository } from './organization.repo.js';
import { OrgResponse, OrgMemberResponse } from './organization.types.js';

export class OrganizationController {
  private service: OrganizationService;

  constructor() {
    // Models will be imported and passed when the actual Sequelize models are defined.
    // For now, the repos accept `any` model constructor.
    // In production, replace with actual model imports:
    //   import { Organization, ProfileOrganization } from './organization.model.js';
    this.service = new OrganizationService(
      new OrganizationRepository(null as any),
      new ProfileOrgRepository(null as any),
    );
  }

  create = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const org = await this.service.createOrg(req.user!.id, req.body);
      const teamCount = await this.service.getTeamCount(org.id);
      res.status(201).json(this.toOrgResponse(org, teamCount));
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const org = await this.service.getOrgById(req.params.id as string);
      const teamCount = await this.service.getTeamCount(org.id);
      res.json(this.toOrgResponse(org, teamCount));
    } catch (error) {
      next(error);
    }
  };

  tag = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const member = await this.service.tagProfile(req.user!.id, req.body);
      res.status(201).json(this.toMemberResponse(member));
    } catch (error) {
      next(error);
    }
  };

  untag = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.untagProfile(req.params.profileOrgId as string, req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getByProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const members = await this.service.getProfileOrgs(req.params.profileId as string);
      res.json({ organizations: members.map((m: any) => this.toMemberResponse(m)) });
    } catch (error) {
      next(error);
    }
  };

  getMembers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const members = await this.service.getOrgMembers(req.params.id as string);
      res.json({ members: members.map((m: any) => this.toMemberResponse(m)) });
    } catch (error) {
      next(error);
    }
  };

  getTeam = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Employer sees their org's team
      // In production, resolve orgId from the employer's profile
      const orgId = req.params.id || (req as any).orgId;
      const members = await this.service.getOrgMembers(orgId);
      res.json({ team: members.map((m: any) => this.toMemberResponse(m)) });
    } catch (error) {
      next(error);
    }
  };

  private toOrgResponse(org: any, teamCount?: number): OrgResponse {
    const location = typeof org.location === 'string'
      ? JSON.parse(org.location)
      : org.location;

    return {
      id: org.id,
      name: org.name,
      industry: org.industry,
      website: org.website,
      location,
      size: org.size,
      teamCount: teamCount ?? 0,
      createdAt: org.createdAt ? new Date(org.createdAt).toISOString() : new Date().toISOString(),
    };
  }

  private toMemberResponse(member: any): OrgMemberResponse {
    return {
      id: member.id,
      profileId: member.profileId,
      organizationId: member.organizationId,
      role: member.title,
      status: member.status,
      startDate: member.startDate ? new Date(member.startDate).toISOString() : new Date().toISOString(),
      endDate: member.endDate ? new Date(member.endDate).toISOString() : undefined,
      createdAt: member.createdAt ? new Date(member.createdAt).toISOString() : new Date().toISOString(),
    };
  }
}
