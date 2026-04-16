import { BaseRepo } from '../../shared/db/base.repo.js';
import { User, RoleRequest } from './auth.model.js';

export class AuthRepo extends BaseRepo<User> {
  constructor() {
    super(User);
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.model.findOne({
      where: { firebaseUid },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.model.findOne({
      where: { email },
    });
  }

  async findAllUsers(): Promise<User[]> {
    return this.model.findAll({
      order: [['created_at', 'DESC']],
    });
  }
}

export class RoleRequestRepo extends BaseRepo<RoleRequest> {
  constructor() {
    super(RoleRequest);
  }

  async findPendingByUserId(userId: string): Promise<RoleRequest | null> {
    return this.model.findOne({
      where: { userId, status: 'pending' },
    });
  }

  async findAllPending(): Promise<RoleRequest[]> {
    return this.model.findAll({
      where: { status: 'pending' },
      order: [['created_at', 'ASC']],
    });
  }
}
