import { UserRepository } from '../ports/UserRepository';
import { QrCodeGenerator } from '../ports/QrCodeGenerator';
import { NotFoundError } from '../../domain/errors/AppError';

export class GetUserQrUseCase {
  constructor(private readonly users: UserRepository, private readonly qr: QrCodeGenerator) {}

  async execute(userId: string): Promise<Buffer> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    // The QR encodes the opaque token, not the raw user id, so a leaked QR image
    // can be rotated (re-issue a new qrToken) without changing the person's identity.
    return this.qr.generatePng(user.qrToken);
  }
}
