import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findOneByEmail(email: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findOneByPhone(phoneNumber: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { phoneNumber } });
  }

  async findOneById(id: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = this.usersRepository.create(user);
    return this.usersRepository.save(newUser);
  }

  async updatePhoneNumber(id: string, phoneNumber: string): Promise<void> {
    await this.usersRepository.update(id, { phoneNumber });
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

  async createUser(userData: any): Promise<User> {
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(userData.password, salt);

    const newUser = this.usersRepository.create({
      ...userData,
      passwordHash,
      // Ensure defaults
      isActive: true,
      role: userData.role || 'USER'
    });
    
    return this.usersRepository.save(newUser);
  }

  async toggleStatus(id: string): Promise<User> {
    const user = await this.findOneById(id);
    if (!user) throw new NotFoundException('User not found');
    
    user.isActive = !user.isActive;
    return this.usersRepository.save(user);
  }
}
