import { pool } from '../infrastructure/db/pg/pool';
import { PgUserRepository } from '../infrastructure/db/pg/PgUserRepository';
import { PgAttendanceRepository } from '../infrastructure/db/pg/PgAttendanceRepository';
import { PgPointTransactionRepository } from '../infrastructure/db/pg/PgPointTransactionRepository';
import { PgPrizeRepository } from '../infrastructure/db/pg/PgPrizeRepository';
import { PgEventRepository } from '../infrastructure/db/pg/PgEventRepository';
import { PgDatabaseExportRepository } from '../infrastructure/db/pg/PgDatabaseExportRepository';
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
  GetRedeemedPrizeIdsUseCase,
} from '../application/prizes/PrizeUseCases';
import {
  CreateEventUseCase,
  UpdateEventUseCase,
  DeleteEventUseCase,
  ListEventsUseCase,
  GetEventRosterUseCase,
  GetMyEventPaymentsUseCase,
  RecordEventPaymentUseCase,
  UpdateEventPaymentUseCase,
  DeleteEventPaymentUseCase,
  SetMemberEventTotalUseCase,
} from '../application/events/EventUseCases';
import {
  AssignRaffleNumberUseCase,
  ListRaffleNumbersUseCase,
  ResetRaffleNumbersUseCase,
} from '../application/raffle/RaffleUseCases';
import { SendWeeklyReportUseCase } from '../application/telegram/SendWeeklyReportUseCase';
import { ExportQrSheetUseCase } from '../application/export/ExportQrSheetUseCase';
import { ExportDatabaseUseCase } from '../application/admin/ExportDatabaseUseCase';

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
  const eventRepo = new PgEventRepository(pool);
  const dbExportRepo = new PgDatabaseExportRepository(pool);

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
    updateUser: new UpdateUserUseCase(userRepo, hasher),
    getUserQr: new GetUserQrUseCase(userRepo, qr),
    checkIn: new CheckInUseCase(userRepo, attendanceRepo, pointTxRepo, clock, env.attendancePoints, env.meetingDayOfWeek),
    getAbsentees: absenteesUseCase,
    assignRaffleNumber: new AssignRaffleNumberUseCase(userRepo),
    listRaffleNumbers: new ListRaffleNumbersUseCase(userRepo),
    resetRaffleNumbers: new ResetRaffleNumbersUseCase(userRepo),
    adjustPoints: new AdjustPointsUseCase(userRepo, pointTxRepo),
    getPointsHistory: new GetPointsHistoryUseCase(userRepo, pointTxRepo),
    getLeaderboard: new GetLeaderboardUseCase(userRepo),
    createPrize: new CreatePrizeUseCase(prizeRepo),
    updatePrize: new UpdatePrizeUseCase(prizeRepo),
    deletePrize: new DeletePrizeUseCase(prizeRepo),
    listPrizes: new ListPrizesUseCase(prizeRepo),
    redeemPrize: new RedeemPrizeUseCase(prizeRepo, userRepo, pointTxRepo),
    getRedeemedPrizeIds: new GetRedeemedPrizeIdsUseCase(prizeRepo),
    createEvent: new CreateEventUseCase(eventRepo),
    updateEvent: new UpdateEventUseCase(eventRepo),
    deleteEvent: new DeleteEventUseCase(eventRepo),
    listEvents: new ListEventsUseCase(eventRepo, clock),
    getEventRoster: new GetEventRosterUseCase(eventRepo, userRepo),
    getMyEventPayments: new GetMyEventPaymentsUseCase(eventRepo),
    recordEventPayment: new RecordEventPaymentUseCase(eventRepo, userRepo),
    updateEventPayment: new UpdateEventPaymentUseCase(eventRepo),
    deleteEventPayment: new DeleteEventPaymentUseCase(eventRepo),
    setMemberEventTotal: new SetMemberEventTotalUseCase(eventRepo, userRepo),
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
    exportDatabase: new ExportDatabaseUseCase(dbExportRepo, exporter),
  };

  return {
    userRepo,
    attendanceRepo,
    pointTxRepo,
    prizeRepo,
    eventRepo,
    dbExportRepo,
    hasher,
    tokens,
    qr,
    clock,
    bot,
    exporter,
    useCases,
  };
}

export type Container = ReturnType<typeof buildContainer>;
