import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth.service.js';
import { AppError } from '../../../shared/errors/appError.js';
import { capabilityRepo } from '../../capability/capability.repo.js';

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn(),
  },
}));

vi.mock('../../capability/capability.repo.js', () => ({
  capabilityRepo: {
    listActiveNames: vi.fn().mockResolvedValue([]),
    grantByAdmin: vi.fn(),
    listActive: vi.fn(),
    revoke: vi.fn(),
  },
}));

function makeUser(overrides: Record<string, unknown> = {}) {
  const data = {
    id: '0c4f3dcf-3142-4956-9d64-3b5024382b14',
    email: 'new.user@example.com',
    displayName: 'New User',
    role: 'INDIVIDUAL',
    status: 'active',
    provider: 'internal',
    avatarUrl: null,
    ...overrides,
  };
  return {
    ...data,
    getDataValue: (key: keyof typeof data) => data[key],
    update: vi.fn(),
  };
}

describe('AuthService admin methods', () => {
  const repo = {
    findByEmail: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(repo as any);
    vi.spyOn(service, 'issueJwt').mockResolvedValue('jwt-token');
  });

  it('createUserByAdmin returns created user + access token', async () => {
    repo.findByEmail.mockResolvedValue(null);
    repo.create.mockResolvedValue(
      makeUser({
        id: '8f6efff5-66cc-432c-b24a-100000000001',
        email: 'created@example.com',
        displayName: 'Created User',
        role: 'EMPLOYER',
      }),
    );

    const result = await service.createUserByAdmin({
      email: 'created@example.com',
      password: 'Secret_1234',
      name: 'Created User',
      role: 'EMPLOYER',
      phone: '+6590011000',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'created@example.com',
        displayName: 'Created User',
        role: 'EMPLOYER',
        phone: '+6590011000',
      }),
    );
    expect(result).toMatchObject({
      accessToken: 'jwt-token',
      user: {
        email: 'created@example.com',
        role: 'EMPLOYER',
      },
    });
  });

  it('createUserByAdmin throws EMAIL_ALREADY_EXISTS for duplicate email', async () => {
    repo.findByEmail.mockResolvedValue(makeUser());

    await expect(
      service.createUserByAdmin({
        email: 'new.user@example.com',
        password: 'Secret_1234',
        name: 'New User',
        role: 'INDIVIDUAL',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS', statusCode: 409 } satisfies Partial<AppError>);
  });

  it('adminGrantCapability returns active capabilities for target user', async () => {
    repo.findById.mockResolvedValue(makeUser({ id: 'f2e89b53-9eb0-4992-a17f-a3ad9f31fd70' }));
    vi.mocked(capabilityRepo.listActive).mockResolvedValue([
      { capability: 'recruiter', source: 'admin-grant', expiresAt: null },
    ]);

    const result = await service.adminGrantCapability(
      'f2e89b53-9eb0-4992-a17f-a3ad9f31fd70',
      '7a2177aa-5306-4ee4-bf8f-05e74ed5b5a5',
      { capability: 'recruiter', reason: 'support' },
    );

    expect(capabilityRepo.grantByAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'f2e89b53-9eb0-4992-a17f-a3ad9f31fd70',
        capability: 'recruiter',
      }),
    );
    expect(result.capabilities).toEqual([{ capability: 'recruiter', source: 'admin-grant', expiresAt: null }]);
  });

  it('adminGrantCapability throws USER_NOT_FOUND when target is missing', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      service.adminGrantCapability('f2e89b53-9eb0-4992-a17f-a3ad9f31fd70', 'admin-user', {
        capability: 'recruiter',
      }),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND', statusCode: 404 } satisfies Partial<AppError>);
  });

  it('adminRevokeCapability expires capability and returns active capabilities', async () => {
    repo.findById.mockResolvedValue(makeUser({ id: 'f2e89b53-9eb0-4992-a17f-a3ad9f31fd70' }));
    vi.mocked(capabilityRepo.listActive).mockResolvedValue([]);

    const result = await service.adminRevokeCapability('f2e89b53-9eb0-4992-a17f-a3ad9f31fd70', 'recruiter');

    expect(capabilityRepo.revoke).toHaveBeenCalledWith('f2e89b53-9eb0-4992-a17f-a3ad9f31fd70', 'recruiter');
    expect(result.capabilities).toEqual([]);
  });

  it('adminRevokeCapability throws USER_NOT_FOUND when target is missing', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      service.adminRevokeCapability('f2e89b53-9eb0-4992-a17f-a3ad9f31fd70', 'recruiter'),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND', statusCode: 404 } satisfies Partial<AppError>);
  });
});
