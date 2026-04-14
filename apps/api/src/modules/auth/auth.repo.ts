import { BaseRepo } from '../../shared/db/base.repo.js';
import { User } from './auth.model.js';

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
}
