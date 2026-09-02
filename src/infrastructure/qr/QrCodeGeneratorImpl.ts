import QRCode from 'qrcode';
import { QrCodeGenerator } from '../../application/ports/QrCodeGenerator';

export class QrCodeGeneratorImpl implements QrCodeGenerator {
  async generatePng(data: string): Promise<Buffer> {
    return QRCode.toBuffer(data, { type: 'png', width: 512, margin: 2 });
  }
}
