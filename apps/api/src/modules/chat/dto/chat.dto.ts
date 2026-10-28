import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsArray,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MessageType,
  ParticipantRole,
} from '@interest/shared';

export class CreateDirectChatDto {
  @IsUUID('4')
  @IsNotEmpty()
  targetUserId: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  initialText?: string;

  @IsUUID('4')
  @IsOptional()
  initialReelId?: string;
}

export class CreateGroupChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  participantUserIds: string[];

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  disappearingTtlSeconds?: number;
}

export class SendMessageDto {
  @IsUUID('4')
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  text?: string;

  @IsEnum(MessageType)
  @IsOptional()
  messageType?: MessageType = MessageType.TEXT;

  @IsString()
  @IsOptional()
  voiceUrl?: string;

  @IsNumber()
  @IsOptional()
  @Min(0.5)
  @Max(300) // 5 minutes max voice note
  voiceDurationSeconds?: number;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  voiceWaveform?: number[];

  @IsUUID('4')
  @IsOptional()
  attachedReelId?: string;

  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @IsString()
  @IsOptional()
  mediaType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  clientMsgId?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  expiresInSeconds?: number;
}

export class EditMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text: string;
}

export class DeleteMessageDto {
  @IsBoolean()
  @IsOptional()
  deleteForEveryone?: boolean = false;
}

export class MarkDeliveredDto {
  @IsUUID('4')
  @IsOptional()
  messageId?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  seqNum?: number;
}

export class SyncMessagesQueryDto {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  sinceSeq?: number = 0;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class AddParticipantDto {
  @IsUUID('4')
  @IsNotEmpty()
  userId: string;
}

export class UpdateParticipantRoleDto {
  @IsEnum(ParticipantRole)
  @IsNotEmpty()
  role: ParticipantRole;
}

export class ReportMessageDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  details?: string;
}

export class ToggleConversationControlDto {
  @IsBoolean()
  @IsOptional()
  isMuted?: boolean;

  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;
}

export class UpdateContactPrivacyDto {
  @IsEnum(['EVERYONE', 'FOLLOWERS_ONLY', 'NOBODY'])
  @IsNotEmpty()
  messagePrivacy: 'EVERYONE' | 'FOLLOWERS_ONLY' | 'NOBODY';
}

export class UpdateDisappearingTimerDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  ttlSeconds?: number | null; // 0 or null = disabled, 86400 = 24h, 604800 = 7d
}

export class RespondRequestDto {
  @IsEnum(['ACCEPT', 'DECLINE', 'BLOCK'])
  action: 'ACCEPT' | 'DECLINE' | 'BLOCK';
}

export class ChatPrivacySettingsDto {
  @IsBoolean()
  readReceiptsEnabled: boolean;

  @IsEnum(['STANDARD', 'STRICT', 'OFF'])
  messageRequestsFilter: 'STANDARD' | 'STRICT' | 'OFF';

  @IsEnum(['EVERYONE', 'FOLLOWERS_ONLY', 'NOBODY'])
  @IsOptional()
  messagePrivacy?: 'EVERYONE' | 'FOLLOWERS_ONLY' | 'NOBODY';
}

export class GetConversationsQueryDto {
  @IsEnum(['primary', 'requests', 'archived'])
  @IsOptional()
  folder?: 'primary' | 'requests' | 'archived' = 'primary';

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number = 0;
}

export class GetMessagesQueryDto {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsString()
  @IsOptional()
  beforeCursor?: string; // Message ID or timestamp for cursor-based pagination
}
