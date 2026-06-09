import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Subscription } from './entities/subscription.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
  ) {}

  async onModuleInit() {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminPassword) {
      const existingAdmin = await this.findOneByEmail('admin@themis.com');
      if (!existingAdmin) {
        const salt = await bcrypt.genSalt();
        const passwordHash = await bcrypt.hash(adminPassword, salt);
        const adminUser = this.usersRepository.create({
          fullName: 'Super Admin',
          email: 'admin@themis.com',
          passwordHash,
          role: 'ADMIN',
          isActive: true,
        } as unknown as User);
        const saved = await this.usersRepository.save(adminUser) as User;
        await this.subscriptionRepository.save(
          this.subscriptionRepository.create({ userId: saved.id, subscriptionStatus: 'active' })
        );
        console.log('Seeded default Super Admin account (admin@themis.com).');
      }
    }
  }

  async findOneByEmail(email: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findOneById(id: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = this.usersRepository.create(user);
    const saved = await this.usersRepository.save(newUser);
    await this.subscriptionRepository.save(
      this.subscriptionRepository.create({ userId: saved.id, subscriptionStatus: 'trial' })
    );
    return this.findOneById(saved.id);
  }

  async updateProfile(id: string, data: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, data);
    return this.findOneById(id);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.usersRepository.update(id, { passwordHash });
  }

  // --- Admin Methods ---

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      order: { createdAt: 'DESC' }
    });
  }

  async findAllPaginated(page: number, limit: number, search?: string, status?: string): Promise<{ data: User[]; total: number; page: number; limit: number }> {
    const query = this.usersRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.subscription', 'subscription');

    if (search) {
      query.where(
        '(LOWER(user.fullName) LIKE :search OR LOWER(user.email) LIKE :search OR LOWER(user.role) LIKE :search)',
        { search: `%${search.toLowerCase()}%` }
      );
    }

    if (status) {
      query.andWhere('subscription.subscriptionStatus = :status', { status });
    }

    query.orderBy('user.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();
    return { data, total, page, limit };
  }

  async createUser(userData: any): Promise<User> {
    const { subscriptionStatus, subscriptionExpiresAt, mpSubscriptionId, subscriptionPlan, password, ...rest } = userData;
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(password, salt);

    const userColumns = this.usersRepository.metadata.columns.map(col => col.propertyName);
    const userPayload: any = { passwordHash, isActive: true, role: rest.role || 'USER' };
    for (const key of Object.keys(rest)) {
        if (userColumns.includes(key)) {
            userPayload[key] = rest[key];
        }
    }

    const newUser = this.usersRepository.create(userPayload as unknown as User);
    const savedUser = await this.usersRepository.save(newUser) as User;

    await this.subscriptionRepository.save(
      this.subscriptionRepository.create({
        userId: savedUser.id,
        subscriptionStatus: subscriptionStatus ?? 'trial',
        subscriptionPlan: subscriptionPlan ?? 'pro',
        subscriptionExpiresAt: subscriptionExpiresAt ?? null,
        mpSubscriptionId: mpSubscriptionId ?? null,
      })
    );

    return this.findOneById(savedUser.id);
  }

  async toggleStatus(id: string): Promise<User> {
    const user = await this.findOneById(id);
    if (!user) throw new NotFoundException('User not found');

    user.isActive = !user.isActive;
    return this.usersRepository.save(user);
  }

  async updateUser(id: string, updateData: any): Promise<User> {
    const user = await this.findOneById(id);
    if (!user) throw new NotFoundException('User not found');

    const { subscriptionStatus, subscriptionExpiresAt, mpSubscriptionId, subscriptionPlan, password, ...rest } = updateData;

    if (password) {
        const salt = await bcrypt.genSalt();
        rest.passwordHash = await bcrypt.hash(password, salt);
    }

    const userColumns = this.usersRepository.metadata.columns.map(col => col.propertyName);
    const updatePayload: any = {};
    for (const key of Object.keys(rest)) {
        if (userColumns.includes(key)) {
            updatePayload[key] = rest[key];
        }
    }

    if (Object.keys(updatePayload).length > 0) {
        await this.usersRepository.update(id, updatePayload);
    }

    const subData: any = {};
    if (subscriptionStatus !== undefined) subData.subscriptionStatus = subscriptionStatus;
    if (subscriptionExpiresAt !== undefined) subData.subscriptionExpiresAt = subscriptionExpiresAt;
    if (subscriptionPlan !== undefined) subData.subscriptionPlan = subscriptionPlan;
    if (mpSubscriptionId !== undefined) subData.mpSubscriptionId = mpSubscriptionId;

    if (Object.keys(subData).length > 0) {
        await this.updateSubscription(id, subData);
    }

    return this.findOneById(id);
  }

  async deleteUser(id: string): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
        throw new NotFoundException('User not found');
    }
  }

  async updateSubscription(id: string, data: {
    subscriptionStatus?: string;
    subscriptionExpiresAt?: Date;
    mpSubscriptionId?: string;
    subscriptionPlan?: string;
  }): Promise<void> {
    let sub = await this.subscriptionRepository.findOne({ where: { userId: id } });
    if (!sub) {
      sub = this.subscriptionRepository.create({ userId: id, subscriptionStatus: 'trial' });
    }
    Object.assign(sub, data);
    await this.subscriptionRepository.save(sub);
  }
}
