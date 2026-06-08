import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminPassword) {
      // Check if admin already exists
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
          subscriptionStatus: 'active'
        } as any);
        await this.usersRepository.save(adminUser);
        console.log('Seeded default Super Admin account (admin@themis.com).');
      } else {
        // Option: we could also force update the password here, but usually seeder only creates it
        // If we want to strictly allow overriding the password via env, we can uncomment below:
        /*
        const salt = await bcrypt.genSalt();
        existingAdmin.passwordHash = await bcrypt.hash(adminPassword, salt);
        await this.usersRepository.save(existingAdmin);
        console.log('Updated Super Admin password from env.');
        */
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
    return this.usersRepository.save(newUser);
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
    const query = this.usersRepository.createQueryBuilder('user');

    if (search) {
      query.where(
        '(LOWER(user.fullName) LIKE :search OR LOWER(user.email) LIKE :search OR LOWER(user.role) LIKE :search)',
        { search: `%${search.toLowerCase()}%` }
      );
    }

    if (status) {
      query.andWhere('user.subscriptionStatus = :status', { status });
    }

    query.orderBy('user.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();
    return { data, total, page, limit };
  }

  async createUser(userData: any): Promise<User> {
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(userData.password, salt);

    const newUser = this.usersRepository.create({
      ...userData,
      passwordHash,
      isActive: true,
      role: userData.role || 'USER'
    } as unknown as User); // Force cast to avoid ambiguous overload
    
    return (await this.usersRepository.save(newUser)) as User; // Force cast return checking
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

    if (updateData.password) {
        const salt = await bcrypt.genSalt();
        updateData.passwordHash = await bcrypt.hash(updateData.password, salt);
        delete updateData.password;
    }

    await this.usersRepository.update(id, updateData);
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
  }): Promise<void> {
    await this.usersRepository.update(id, data);
  }
}
