import { pool } from '../infrastructure/db/pg/pool';
import { PgUserRepository } from '../infrastructure/db/pg/PgUserRepository';
import { PgAttendanceRepository } from '../infrastructure/db/pg/PgAttendanceRepository';
import { PgPointTransactionRepository } from '../infrastructure/db/pg/PgPointTransactionRepository';
import { PgPrizeRepository } from '../infrastructure/db/pg/PgPrizeRepository';
import { BcryptPasswordHasher } from '../infrastructure/auth/BcryptPasswordHasher';
import { JwtTokenService } from '../infrastructure/auth/JwtTokenService';
import { QrCodeGeneratorImpl } from '../infrastructure/qr/QrCodeGeneratorImpl';
import { SystemClock } from '../infrastructure/SystemClock';
import { TelegramNotificationBot } from '../infrastructure/telegram/TelegramNotificationBot';
import { GoogleDriveDocumentExporter } from '../infrastructure/google/GoogleDriveDocumentExporter';

import { LoginUseCase } from '../application/auth/LoginUseCase';
import { ChangePasswordUseCase } from '../application/auth/ChangePasswordUseCase';
import { RegisterUserUseCase } from '../application/members/RegisterUserUseCase';
import { ListUsersUseCase } from '../application/members/ListUsersUseCase';
import { UpdateUserUseCase } from '../application/members/UpdateUserUseCase';
import { GetUserQrUseCase } from '../application/members/GetUserQrUseCase';
import { CheckInUseCase } from '../application/attendance/CheckInUseCase';
import { GetAbsenteesUseCase } from '../application/attendance/GetAbsenteesUseCase';
import { AdjustPointsUseCase } from '../application/points/AdjustPointsUseCase';
import { GetPointsHistoryUseCase } from '../application/points/GetPointsHistoryUseCase';
import { GetLeaderboardUseCase } from '../application/leaderboard/GetLeaderboardUseCase';
import {
  CreatePrizeUseCase,
  UpdatePrizeUseCase,
  DeletePrizeUseCase,
  ListPrizesUseCase,
  RedeemPrizeUseCase,
} from '../application/prizes/PrizeUseCases';
import { SendWeeklyReportUseCase } from '../application/telegram/SendWeeklyReportUseCase';
import { ExportQrSheetUseCase } from '../application/export/ExportQrSheetUseCase';

import { env } from './env';

/**
 * Composition root: the ONLY place that new()s concrete infrastructure
 * classes and wires them into the use-cases. Everything above this file
 * (application + domain) never imports from `infrastructure` directly.
 */
export function buildContainer() {
  const userRepo = new PgUserRepository(pool);
  const attendanceRepo = new PgAttendanceRepository(pool);
  const pointTxRepo = new PgPointTransactionRepository(pool);
  const prizeRepo = new PgPrizeRepository(pool);

  const hasher = new BcryptPasswordHasher();
  const tokens = new JwtTokenService(env.jwtSecret, env.jwtExpiresIn);
  const qr = new QrCodeGeneratorImpl();
  const clock = new SystemClock();
  const bot = new TelegramNotificationBot(env.telegramBotToken);
  const exporter = new GoogleDriveDocumentExporter({
    serviceAccountJson: env.googleServiceAccountJson,
    driveFolderId: env.googleDriveFolderId,
  });

  const absenteesUseCase = new GetAbsenteesUseCase(userRepo, attendanceRepo);

  const useCases = {
    login: new LoginUseCase(userRepo, hasher, tokens),
    changePassword: new ChangePasswordUseCase(userRepo, hasher),
    registerUser: new RegisterUserUseCase(userRepo, hasher),
    listUsers: new ListUsersUseCase(userRepo),
    updateUser: new UpdateUserUseCase(userRepo),
    getUserQr: new GetUserQrUseCase(userRepo, qr),
    checkIn: new CheckInUseCase(userRepo, attendanceRepo, pointTxRepo, clock, env.attendancePoints, env.meetingDayOfWeek),
    getAbsentees: absenteesUseCase,
    adjustPoints: new AdjustPointsUseCase(userRepo, pointTxRepo),
    getPointsHistory: new GetPointsHistoryUseCase(userRepo, pointTxRepo),
    getLeaderboard: new GetLeaderboardUseCase(userRepo),
    createPrize: new CreatePrizeUseCase(prizeRepo),
    updatePrize: new UpdatePrizeUseCase(prizeRepo),
    deletePrize: new DeletePrizeUseCase(prizeRepo),
    listPrizes: new ListPrizesUseCase(prizeRepo),
    redeemPrize: new RedeemPrizeUseCase(prizeRepo, userRepo, pointTxRepo),
    sendWeeklyReport: new SendWeeklyReportUseCase(
      userRepo,
      attendanceRepo,
      absenteesUseCase,
      bot,
      clock,
      env.meetingDayOfWeek,
      env.telegramAdminChatIds,
    ),
    exportQrSheet: new ExportQrSheetUseCase(userRepo, qr, exporter),
  };

  return { userRepo, attendanceRepo, pointTxRepo, prizeRepo, hasher, tokens, qr, clock, bot, exporter, useCases };
}

export type Container = ReturnType<typeof buildContainer>;
