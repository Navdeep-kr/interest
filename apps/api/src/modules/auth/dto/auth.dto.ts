import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Matches,
  IsEnum,
  IsDateString,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Phone number must be a valid E.164 string' })
  phoneNumber?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username must contain only letters, numbers, and underscores',
  })
  username: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsDateString({}, { message: 'Birthdate must be a valid ISO date string (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'Birthdate is required for age gate compliance' })
  birthdate: string;

  @IsString()
  @IsOptional()
  deviceName?: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier: string; // username or email

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  deviceName?: string;
}

export enum OAuthProvider {
  GOOGLE = 'google',
  APPLE = 'apple',
}

export class OAuthLoginDto {
  @IsEnum(OAuthProvider)
  provider: OAuthProvider;

  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsDateString({}, { message: 'Birthdate must be a valid ISO date string (YYYY-MM-DD)' })
  @IsOptional()
  birthdate?: string;

  @IsString()
  @IsOptional()
  deviceName?: string;
}

export class PhoneOtpRequestDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Phone number must be a valid E.164 string' })
  phoneNumber: string;
}

export class PhoneOtpVerifyDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  code: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsDateString({}, { message: 'Birthdate must be a valid ISO date string (YYYY-MM-DD)' })
  @IsOptional()
  birthdate?: string;

  @IsString()
  @IsOptional()
  deviceName?: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;

  @IsString()
  @IsOptional()
  deviceName?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  newPassword: string;
}

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required for reauthentication' })
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  newPassword: string;
}

export class DeactivateAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'Password is required to confirm account deactivation' })
  password: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class ReactivateAccountDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

