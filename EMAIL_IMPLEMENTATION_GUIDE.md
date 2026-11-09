# Panduan Implementasi Fitur Email (Verify Email & Forgot Password) dengan BullMQ + JWT

Dokumen ini adalah panduan *step-by-step* untuk mengimplementasikan fitur **Email Verification saat Register** dan **Forgot / Reset Password** di `smart-reading-be` menggunakan **BullMQ (Redis)**, **Nodemailer (Gmail SMTP)**, dan **Stateless JWT**.

> **Catatan:** Setiap langkah menjelaskan **apa yang harus kamu lakukan** terlebih dahulu. Jika kamu butuh referensi kodenya, klik bagian **toggle (`▶ 💡 Lihat Referensi Kode`)** di bawah masing-masing langkah.

---

## Daftar Isi
1. [Persiapan Package & Environment Variables (`.env.local`)](#tahap-1-persiapan-package--environment-variables)
2. [Database Migration & Update `UserModel`](#tahap-2-database-migration--update-usermodel)
3. [Update `UsersService` (Method Helper Baru)](#tahap-3-update-usersservice)
4. [Membuat `MailModule` (BullMQ Queue Producer & Worker)](#tahap-4-membuat-mailmodule-bullmq-producer--worker)
5. [Menambahkan DTO di `auth.contract.ts`](#tahap-5-menambahkan-dto-di-authcontractts)
6. [Implementasi Logika di `AuthService` & `AuthModule`](#tahap-6-implementasi-logika-di-authservice--authmodule)
7. [Menambahkan Endpoint di `AuthController`](#tahap-7-menambahkan-endpoint-di-authcontroller)
8. [Cara Testing Alur Lengkap](#tahap-8-cara-testing-alur-lengkap)

---

## Tahap 1: Persiapan Package & Environment Variables

### 1.1 Install `nodemailer`
Karena `@nestjs/bullmq`, `bullmq`, dan `ioredis` sudah ter-install di `smart-reading-be`, kamu hanya perlu meng-install `nodemailer` beserta *type definitions*-nya.

- Jalankan perintah instalasi pakai `yarn` di folder `smart-reading-be`.

<details>
<summary>💡 Lihat Perintah Terminal</summary>

```bash
cd /home/khoiri/code/SKRIPSI/smart-reading-be
yarn add nodemailer
yarn add -D @types/nodemailer
```
</details>

### 1.2 Tambahkan Konfigurasi di `.env.local`
Buka file `.env.local` dan tambahkan variabel berikut:
1. Konfigurasi SMTP Gmail (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).
2. Secret khusus untuk JWT verifikasi email (`JWT_SECRET_EMAIL_VERIFY`) — opsional, atau bisa digabung dari `JWT_SECRET_ACCESS`.
3. URL Backend (`BACKEND_URL`, misal `http://localhost:4000`) untuk link verifikasi email jika langsung mengarah ke endpoint backend.

<details>
<summary>💡 Lihat Contoh Konfigurasi <code>.env.local</code></summary>

```env
# SMTP Gmail Configuration (Gunakan 16 digit Google App Password di SMTP_PASS)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=emailkamu@gmail.com
SMTP_PASS=abcdefghijklmnop
SMTP_FROM="Smart Reading <emailkamu@gmail.com>"

# JWT Secret tambahan untuk verifikasi email
JWT_SECRET_EMAIL_VERIFY=secret-khusus-verifikasi-email-smart-reading

# URL untuk link di dalam email
BACKEND_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
```
</details>

---

## Tahap 2: Database Migration & Update `UserModel`

Karena kita menggunakan **JWT** untuk mengatur masa berlaku token (*expiry* otomatis di dalam JWT), kita **hanya butuh 1 kolom baru** di tabel `users`, yaitu `is_email_verified` (`BOOLEAN`).

### 2.1 Buat File Migration Baru
1. Buat file migration baru di folder `resources/sql/migrations/`, misalnya:
   `resources/sql/migrations/20261108150000-add-is-email-verified-in-table-users.js`
2. Di fungsi `up`: tambahkan kolom `is_email_verified` ke tabel `users` dengan tipe `Sequelize.BOOLEAN`, `allowNull: false`, dan `defaultValue: false`.
   *(Opsional: kamu juga bisa meng-update user lama yang sudah ada di DB agar `is_email_verified = true` supaya akun testing lama tidak terkunci).*
3. Di fungsi `down`: hapus kolom `is_email_verified` dari tabel `users`.
4. Jalankan migration dengan `yarn run-migration`.

<details>
<summary>💡 Lihat Referensi Kode Migration</summary>

```javascript
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'is_email_verified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Opsional: Set user yang sudah ada sebelumnya menjadi terverifikasi
    await queryInterface.sequelize.query(
      `UPDATE users SET is_email_verified = true WHERE is_email_verified = false;`,
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'is_email_verified');
  },
};
```
</details>

### 2.2 Update Entity `src/modules/users/users.entity.ts`
Buka `src/modules/users/users.entity.ts` dan tambahkan deklarasi kolom `isEmailVerified` (`DataType.BOOLEAN`, default `false`).
*(Karena `UserModel` menggunakan `underscored: true`, properti `isEmailVerified` di TypeScript otomatis terhubung ke kolom `is_email_verified` di PostgreSQL).*

<details>
<summary>💡 Lihat Referensi Kode <code>users.entity.ts</code></summary>

```typescript
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare isEmailVerified: boolean;
```
</details>

---

## Tahap 3: Update `UsersService`

Buka `src/modules/users/users.service.ts` dan lakukan beberapa penyesuaian berikut:

1. **Tambahkan `'isEmailVerified'` ke `RETURN_COLUMNS_FOR_LOGIN`** (baris 24) supaya saat `findOneByEmail` dipanggil ketika login, nilai `isEmailVerified` ikut terambil dari database.
2. **Di method `create()` (register via email):** Pastikan `isEmailVerified: false` saat membuat user baru.
3. **Di method `createByGoogle()` (login via Google):** Set `isEmailVerified: true` karena akun dari Google OAuth sudah pasti terverifikasi.
4. **Buat 2 method baru di `UsersService`:**
   - `markEmailAsVerified(userId: string)`: meng-update `isEmailVerified: true` berdasarkan `userId`, lalu mengembalikan data user beserta `role.permissions` (agar bisa langsung dibuatkan token login).
   - `updatePassword({ userId, newPassword }: { userId: string; newPassword: string })`: meng-hash `newPassword` dengan `bcrypt`, lalu meng-update `passwordHash` sekaligus mereset `refreshTokenHash: null` (agar sesi login lama otomatis logout).
   - `findOneWithPasswordHash(userId: string)`: mengambil user berdasarkan `userId` termasuk kolom `passwordHash` dan `isEmailVerified` (dibutuhkan saat memverifikasi token JWT reset password one-time use).

<details>
<summary>💡 Lihat Referensi Kode <code>users.service.ts</code></summary>

```typescript
// 1. Update konstanta di bagian atas file:
const RETURN_COLUMNS_FOR_LOGIN = [
  'email',
  'name',
  'userId',
  'isEmailVerified',
];

// 2. Di dalam createByGoogle(), tambahkan isEmailVerified: true:
    const data = {
      ...params,
      roleId,
      authProvider: 'google',
      isEmailVerified: true,
      userId: uuidv4(),
    };

// 3. Tambahkan method-method baru di dalam class UsersService:
  async findOneWithPasswordHash(userId: string) {
    const user = await this.userModel.findOne({
      where: { userId },
      attributes: ['passwordHash', ...RETURN_COLUMNS_FOR_LOGIN],
      include: {
        model: RoleModel,
        attributes: ['permissions'],
        as: 'role',
      },
    });
    return user;
  }

  async markEmailAsVerified(userId: string) {
    await this.userModel.update(
      { isEmailVerified: true },
      { where: { userId } },
    );

    const user = await this.userModel.findOne({
      where: { userId },
      attributes: RETURN_COLUMNS_FOR_LOGIN,
      include: {
        model: RoleModel,
        attributes: ['permissions'],
        as: 'role',
      },
    });
    if (!user) throw new NotFoundException();
    return user;
  }

  async updatePassword({
    userId,
    newPassword,
  }: {
    userId: string;
    newPassword: string;
  }) {
    const passwordHash = await hash(
      newPassword,
      Number(process.env.BCRYPT_SALT_ROUNDS),
    );

    await this.userModel.update(
      {
        passwordHash,
        refreshTokenHash: null, // Cabut semua sesi refresh token lama
      },
      { where: { userId } },
    );
  }
```
</details>

---

## Tahap 4: Membuat `MailModule` (BullMQ Producer & Worker)

Buat folder baru di `src/modules/mail/` yang berisi 4 file (polanya mirip dengan `src/modules/reading-history/`):
1. `mail.constants.ts`
2. `mail.service.ts`
3. `mail.processor.ts`
4. `mail.module.ts`

### 4.1 Buat `src/modules/mail/mail.constants.ts`
Definisikan:
- Nama queue: `export const MAIL_QUEUE = 'mail';`
- Nama-nama job (`SEND_VERIFY_EMAIL`, `SEND_RESET_PASSWORD`)
- Interface payload data job (`VerifyEmailJobData` dan `ResetPasswordJobData` yang berisi `email`, `name`, dan `token`).

<details>
<summary>💡 Lihat Referensi Kode <code>mail.constants.ts</code></summary>

```typescript
export const MAIL_QUEUE = 'mail';

export const MailJobName = {
  VERIFY_EMAIL: 'send-verification-email',
  RESET_PASSWORD: 'send-reset-password-email',
} as const;

export interface VerifyEmailJobData {
  email: string;
  name: string;
  token: string;
}

export interface ResetPasswordJobData {
  email: string;
  name: string;
  token: string;
}
```
</details>

### 4.2 Buat `src/modules/mail/mail.service.ts` (BullMQ Producer)
Buat `MailService` yang meng-inject queue BullMQ menggunakan `@InjectQueue(MAIL_QUEUE)`.
- Buat fungsi `enqueueVerificationEmail(data: VerifyEmailJobData)` yang memanggil `this.mailQueue.add(...)`.
- Buat fungsi `enqueueResetPasswordEmail(data: ResetPasswordJobData)` yang memanggil `this.mailQueue.add(...)`.
- Gunakan opsi `{ attempts: 3, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: true }` agar otomatis retry sampai 3 kali jika koneksi SMTP gagal.

<details>
<summary>💡 Lihat Referensi Kode <code>mail.service.ts</code></summary>

```typescript
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  MAIL_QUEUE,
  MailJobName,
  ResetPasswordJobData,
  VerifyEmailJobData,
} from './mail.constants';

@Injectable()
export class MailService {
  constructor(@InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue) {}

  async enqueueVerificationEmail(data: VerifyEmailJobData) {
    await this.mailQueue.add(MailJobName.VERIFY_EMAIL, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: true,
    });
  }

  async enqueueResetPasswordEmail(data: ResetPasswordJobData) {
    await this.mailQueue.add(MailJobName.RESET_PASSWORD, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: true,
    });
  }
}
```
</details>

### 4.3 Buat `src/modules/mail/mail.processor.ts` (BullMQ Consumer / Worker)
Buat class `MailProcessor extends WorkerHost` dengan decorator `@Processor(MAIL_QUEUE)`.
1. Di `constructor`, inisialisasi `nodemailer.createTransport(...)` menggunakan konfigurasi dari `ConfigService` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).
2. Di method `process(job: Job)`:
   - Jika `job.name === MailJobName.VERIFY_EMAIL`:
     Buat URL verifikasi `${backendUrl}/auth/verify-email?token=${token}` (atau ke halaman frontend jika kamu ingin lewat UI frontend dulu), lalu kirim email HTML via `this.transporter.sendMail(...)`.
   - Jika `job.name === MailJobName.RESET_PASSWORD`:
     Buat URL reset password `${frontendUrl}/reset-password?token=${token}`, lalu kirim email HTML via `this.transporter.sendMail(...)`.
3. Tambahkan `@OnWorkerEvent('failed')` untuk mencatat log jika pengiriman gagal.

<details>
<summary>💡 Lihat Referensi Kode <code>mail.processor.ts</code></summary>

```typescript
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import {
  MAIL_QUEUE,
  MailJobName,
  ResetPasswordJobData,
  VerifyEmailJobData,
} from './mail.constants';

@Processor(MAIL_QUEUE, { concurrency: 5 })
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    super();
    const port = Number(this.config.get<number>('SMTP_PORT') ?? 465);
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port,
      secure: port === 465,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
  }

  async process(
    job: Job<VerifyEmailJobData | ResetPasswordJobData>,
  ): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const backendUrl =
      this.config.get<string>('BACKEND_URL') ?? 'http://localhost:4000';
    const from =
      this.config.get<string>('SMTP_FROM') ??
      this.config.get<string>('SMTP_USER');

    switch (job.name) {
      case MailJobName.VERIFY_EMAIL: {
        const { email, name, token } = job.data;
        const verifyUrl = `${backendUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;

        await this.transporter.sendMail({
          from,
          to: email,
          subject: 'Verifikasi Email Akun Smart Reading',
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2>Halo, ${name}!</h2>
              <p>Terima kasih telah mendaftar di Smart Reading. Silakan klik tombol di bawah untuk memverifikasi email kamu:</p>
              <p>
                <a href="${verifyUrl}" style="background: #4F46E5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Verifikasi Email Saya
                </a>
              </p>
              <p>Link ini berlaku selama 24 jam.</p>
            </div>
          `,
        });
        this.logger.log(`Verification email sent to ${email}`);
        break;
      }

      case MailJobName.RESET_PASSWORD: {
        const { email, name, token } = job.data;
        const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

        await this.transporter.sendMail({
          from,
          to: email,
          subject: 'Reset Password Akun Smart Reading',
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2>Halo, ${name}!</h2>
              <p>Kami menerima permintaan untuk mereset password akun kamu. Klik tombol di bawah untuk membuat password baru:</p>
              <p>
                <a href="${resetUrl}" style="background: #DC2626; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Reset Password
                </a>
              </p>
              <p>Link ini hanya berlaku selama 15 menit dan hanya dapat digunakan satu kali.</p>
              <p>Jika kamu tidak merasa meminta reset password, abaikan email ini.</p>
            </div>
          `,
        });
        this.logger.log(`Reset password email sent to ${email}`);
        break;
      }
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error) {
    if (!job) return;
    this.logger.warn(
      `Mail job ${job.id} (${job.name}) failed on attempt ${job.attemptsMade}: ${err.message}`,
    );
  }
}
```
</details>

### 4.4 Buat `src/modules/mail/mail.module.ts`
Daftarkan `BullModule.registerQueue({ name: MAIL_QUEUE })`, masukkan `MailService` dan `MailProcessor` ke `providers`, serta export `MailService`.

<details>
<summary>💡 Lihat Referensi Kode <code>mail.module.ts</code></summary>

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MAIL_QUEUE } from './mail.constants';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';

@Module({
  imports: [BullModule.registerQueue({ name: MAIL_QUEUE })],
  providers: [MailService, MailProcessor],
  exports: [MailService],
})
export class MailModule {}
```
</details>

---

## Tahap 5: Menambahkan DTO di `auth.contract.ts`

Buka `src/modules/auth/auth.contract.ts` dan tambahkan class DTO untuk validasi input & dokumentasi Swagger:
1. **`VerifyEmailQuery`**: properti `token` (`@IsString()`, `@IsNotEmpty()`) dan `isRedirect` (opsional, sama seperti `RedirectParam`).
2. **`ResendVerificationRequest`**: properti `email` (`@IsEmail()`, `@IsNotEmpty()`).
3. **`ForgotPasswordRequest`**: properti `email` (`@IsEmail()`, `@IsNotEmpty()`).
4. **`ResetPasswordRequest`**: properti `token` (`@IsString()`, `@IsNotEmpty()`) dan `newPassword` (`@IsString()`, `@MinLength(8)`, `@MaxLength(128)`).
5. **`MessageResponse`**: properti `message: string` untuk response sukses kirim email.

<details>
<summary>💡 Lihat Referensi Kode Tambahan di <code>auth.contract.ts</code></summary>

```typescript
export class VerifyEmailQuery extends RedirectParam {
  @ApiProperty({ description: 'Verification JWT token from email link' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class ResendVerificationRequest {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  email!: string;
}

export class ForgotPasswordRequest {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  email!: string;
}

export class ResetPasswordRequest {
  @ApiProperty({ description: 'Reset password JWT token from email link' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class MessageResponse {
  @ApiProperty({ example: 'Please check your email.' })
  message!: string;
}
```
</details>

---

## Tahap 6: Implementasi Logika di `AuthService` & `AuthModule`

### 6.1 Import `MailModule` di `src/modules/auth/auth.module.ts`
Tambahkan `MailModule` ke dalam array `imports` di `AuthModule` agar `MailService` bisa di-inject ke `AuthService`.

<details>
<summary>💡 Lihat Referensi Kode <code>auth.module.ts</code></summary>

```typescript
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [UsersModule, PassportModule, JwtModule.register({}), MailModule],
  // ...
})
export class AuthModule {}
```
</details>

### 6.2 Update Logika di `src/modules/auth/auth.service.ts`
Inject `MailService` di `constructor` `AuthService`, lalu sesuaikan & tambahkan method berikut:

1. **Update `validateUserByEmail(email, password)`:**
   - Setelah cek password cocok, cek apakah `!user.isEmailVerified`.
   - Jika belum terverifikasi, lempar `ForbiddenException('Please verify your email before signing in')`.

2. **Update `signupByEmail(params: SignupRequest)`:**
   - Buat user di DB seperti biasa (`this.userService.create(...)`).
   - Buat JWT verifikasi email dengan `expiresIn: '24h'` dan payload `{ sub: user.userId, email: user.email, purpose: 'verify-email' }`.
   - Masukkan ke antrean BullMQ: `await this.mailService.enqueueVerificationEmail({ email: user.email, name: user.name, token })`.
   - Return `{ message: 'Registration successful. Please check your email to verify your account.' }` (tidak langsung login sebelum verifikasi).

3. **Tambah `verifyEmail(token: string)`:**
   - Verifikasi token dengan `this.jwt.verify<{ sub: string; purpose: string }>(token, { secret: ... })`. Jika gagal/expired, lempar `BadRequestException('Invalid or expired verification token')`.
   - Pastikan `payload.purpose === 'verify-email'`.
   - Panggil `const user = await this.userService.markEmailAsVerified(payload.sub)`.
   - Return `await this.generateTokens({ userId: user.userId, email: user.email, permissions: user.role.permissions })` supaya user otomatis dapat token login!

4. **Tambah `resendVerificationEmail(email: string)`:**
   - Cari user dengan `findOneByEmail(email)`.
   - Jika user ditemukan dan `!user.isEmailVerified`, generate token JWT verifikasi baru (`24h`) dan panggil `enqueueVerificationEmail(...)`.
   - Return pesan sukses.

5. **Tambah `forgotPassword(email: string)`:**
   - Cari user dengan `findOneByEmail(email)`.
   - Jika user ditemukan dan memiliki `passwordHash`:
     - Buat secret dinamis: `const secret = `${process.env.JWT_SECRET_ACCESS}-${user.passwordHash}`` (ini yang membuat token otomatis hangus begitu password berubah!).
     - Sign JWT dengan payload `{ sub: user.userId, purpose: 'reset-password' }`, `secret`, dan `expiresIn: '15m'`.
     - Panggil `await this.mailService.enqueueResetPasswordEmail({ email: user.email, name: user.name, token })`.
   - Selalu return `{ message: 'If that email is registered, a password reset link has been sent.' }` (agar aman dari *email enumeration*).

6. **Tambah `resetPassword({ token, newPassword }: ResetPasswordRequest)`:**
   - Decode dulu isi token tanpa verifikasi (`this.jwt.decode(token)`) untuk mengambil `sub` (`userId`).
   - Ambil data user beserta `passwordHash` saat ini dari DB (`this.userService.findOneWithPasswordHash(decoded.sub)`).
   - Verifikasi signature & expiry token menggunakan `this.jwt.verify(token, { secret: `${process.env.JWT_SECRET_ACCESS}-${user.passwordHash}` })`.
   - Jika valid, panggil `await this.userService.updatePassword({ userId: user.userId, newPassword })`.

<details>
<summary>💡 Lihat Referensi Kode Lengkap Method di <code>auth.service.ts</code></summary>

```typescript
  // Di constructor AuthService:
  constructor(
    private readonly userService: UsersService,
    private readonly jwt: JwtService,
    private readonly mailService: MailService,
  ) {}

  // 1. Update validateUserByEmail:
  async validateUserByEmail(email: string, password: string) {
    const user = await this.userService.findOneByEmail(email);
    if (!user?.passwordHash || !(await compare(password, user.passwordHash)))
      return false;
    if (!user.isEmailVerified) {
      throw new ForbiddenException(
        'Email is not verified. Please check your inbox to verify your account.',
      );
    }
    return user;
  }

  // Helper private untuk membuat token verifikasi email:
  private signVerifyEmailToken(userId: string, email: string) {
    const secret =
      process.env.JWT_SECRET_EMAIL_VERIFY || process.env.JWT_SECRET_ACCESS;
    return this.jwt.sign(
      { sub: userId, email, purpose: 'verify-email' },
      { secret, expiresIn: '24h' },
    );
  }

  // 2. Update signupByEmail:
  async signupByEmail(params: SignupRequest) {
    const email = params.email.trim();
    const existing = await this.userService.findOneByEmail(email);
    if (existing) throw new ConflictException('Email is already registered');

    try {
      const user = await this.userService.create({
        name: params.name,
        email,
        password: params.password,
      });

      const verifyToken = this.signVerifyEmailToken(user.userId, user.email);
      await this.mailService.enqueueVerificationEmail({
        email: user.email,
        name: user.name,
        token: verifyToken,
      });

      return {
        message:
          'Registration successful. Please check your email to verify your account.',
      };
    } catch (error) {
      if (error instanceof UniqueConstraintError)
        throw new ConflictException('Email is already registered');
      throw error;
    }
  }

  // 3. Verify Email:
  async verifyEmail(token: string) {
    const secret =
      process.env.JWT_SECRET_EMAIL_VERIFY || process.env.JWT_SECRET_ACCESS;
    let payload: { sub: string; email: string; purpose: string };

    try {
      payload = this.jwt.verify(token, { secret });
    } catch {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (payload.purpose !== 'verify-email' || !payload.sub) {
      throw new BadRequestException('Invalid verification token');
    }

    const user = await this.userService.markEmailAsVerified(payload.sub);
    return await this.generateTokens({
      userId: user.userId,
      email: user.email,
      permissions: user.role.permissions,
    });
  }

  // 4. Resend Verification Email:
  async resendVerificationEmail(email: string) {
    const user = await this.userService.findOneByEmail(email.trim());
    if (user && !user.isEmailVerified) {
      const verifyToken = this.signVerifyEmailToken(user.userId, user.email);
      await this.mailService.enqueueVerificationEmail({
        email: user.email,
        name: user.name,
        token: verifyToken,
      });
    }
    return {
      message:
        'If your email is registered and unverified, a new verification link has been sent.',
    };
  }

  // 5. Forgot Password:
  async forgotPassword(email: string) {
    const user = await this.userService.findOneByEmail(email.trim());
    if (user && user.passwordHash) {
      const secret = `${process.env.JWT_SECRET_ACCESS}-${user.passwordHash}`;
      const resetToken = this.jwt.sign(
        { sub: user.userId, email: user.email, purpose: 'reset-password' },
        { secret, expiresIn: '15m' },
      );

      await this.mailService.enqueueResetPasswordEmail({
        email: user.email,
        name: user.name,
        token: resetToken,
      });
    }

    return {
      message:
        'If that email is registered, a password reset link has been sent.',
    };
  }

  // 6. Reset Password:
  async resetPassword({ token, newPassword }: ResetPasswordRequest) {
    const decoded = this.jwt.decode(token) as {
      sub?: string;
      purpose?: string;
    } | null;

    if (!decoded?.sub || decoded.purpose !== 'reset-password') {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.userService.findOneWithPasswordHash(decoded.sub);
    if (!user || !user.passwordHash) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const secret = `${process.env.JWT_SECRET_ACCESS}-${user.passwordHash}`;
    try {
      this.jwt.verify(token, { secret });
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }

    await this.userService.updatePassword({
      userId: user.userId,
      newPassword,
    });

    return { message: 'Password has been reset successfully.' };
  }
```
</details>

---

## Tahap 7: Menambahkan Endpoint di `AuthController`

Buka `src/modules/auth/auth.controller.ts`:
1. Sesuaikan `POST /auth/signup-by-email`: karena sekarang mengembalikan `{ message }` (menunggu verifikasi email), hapus pemanggilan `this.setAuthCookies(res, tokens)` di endpoint `signupByEmail`.
2. Tambahkan 4 endpoint baru:
   - `GET /auth/verify-email`: menerima `@Query() query: VerifyEmailQuery`, memanggil `authService.verifyEmail(query.token)`, memasang cookie login (`this.setAuthCookies(res, tokens)`), dan me-redirect ke `${process.env.FRONTEND_URL}/dashboard` (atau return JSON jika `query.isRedirect === false`).
   - `POST /auth/resend-verification`: menerima `@Body() body: ResendVerificationRequest`.
   - `POST /auth/forgot-password`: menerima `@Body() body: ForgotPasswordRequest`.
   - `POST /auth/reset-password`: menerima `@Body() body: ResetPasswordRequest`.

<details>
<summary>💡 Lihat Referensi Kode Endpoint di <code>auth.controller.ts</code></summary>

```typescript
  @Post('signup-by-email')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an account with email and password',
    description:
      'Creates an unverified user account and enqueues a verification email.',
  })
  @ApiBody({ type: SignupRequest })
  @ApiCreatedResponse({
    type: MessageResponse,
    description: 'Account created. Verification email queued.',
  })
  @ApiConflictResponse({ description: 'Email is already registered' })
  async signupByEmail(@Body() body: SignupRequest): Promise<MessageResponse> {
    return await this.authService.signupByEmail(body);
  }

  @Get('verify-email')
  @ApiOperation({
    summary: 'Verify email address from verification link',
    description:
      'Marks the user email as verified, sets auth cookies, and redirects to the frontend dashboard.',
  })
  @ApiOkResponse({ type: AuthTokensResponse })
  async verifyEmail(
    @Query() query: VerifyEmailQuery,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensResponse | void> {
    const tokens = await this.authService.verifyEmail(query.token);
    this.setAuthCookies(res, tokens);

    if (query.isRedirect === false) return tokens;

    return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification link' })
  @ApiBody({ type: ResendVerificationRequest })
  @ApiOkResponse({ type: MessageResponse })
  async resendVerification(
    @Body() body: ResendVerificationRequest,
  ): Promise<MessageResponse> {
    return await this.authService.resendVerificationEmail(body.email);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiBody({ type: ForgotPasswordRequest })
  @ApiOkResponse({ type: MessageResponse })
  async forgotPassword(
    @Body() body: ForgotPasswordRequest,
  ): Promise<MessageResponse> {
    return await this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiBody({ type: ResetPasswordRequest })
  @ApiOkResponse({ type: MessageResponse })
  async resetPassword(
    @Body() body: ResetPasswordRequest,
  ): Promise<MessageResponse> {
    return await this.authService.resetPassword(body);
  }
```
</details>

---

## Tahap 8: Cara Testing Alur Lengkap

Pastikan **PostgreSQL** dan **Redis** kamu sudah menyala, lalu jalankan aplikasi:
```bash
yarn run-migration
yarn start:dev
```

1. **Test Register (`POST /auth/signup-by-email`):**
   - Kirim request dengan email asli kamu.
   - Perhatikan terminal NestJS: `MailProcessor` akan mencetak log `Verification email sent to ...`.
   - Coba langsung login (`POST /auth/signin-by-email`) sebelum klik link di email -> harus ditolak dengan `403 Forbidden (Email is not verified)`.
2. **Test Klik Link Verifikasi (`GET /auth/verify-email?token=...`):**
   - Buka inbox email kamu, klik tombol **Verifikasi Email Saya**.
   - Browser akan diarahkan ke `/dashboard` dan cookie `access_token` serta `refresh_token` otomatis terpasang!
   - Sekarang coba login lagi via `POST /auth/signin-by-email` -> **Berhasil (`200 OK`)**.
3. **Test Forgot Password (`POST /auth/forgot-password`):**
   - Masukkan email kamu.
   - Cek inbox email, copy parameter `token` dari link `/reset-password?token=...`.
4. **Test Reset Password (`POST /auth/reset-password`):**
   - Kirim `{ token, newPassword: "passwordBaru123" }`.
   - Coba kirim request `POST /auth/reset-password` yang sama sekali lagi dengan token tadi -> harus ditolak (`400 Bad Request: Invalid or expired reset token`) karena password sudah berubah (one-time use bekerja!).
   - Coba login dengan password baru -> **Berhasil!**
