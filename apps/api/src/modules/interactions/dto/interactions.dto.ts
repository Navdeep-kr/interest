import { IsString, IsNotEmpty, MaxLength, MinLength, IsOptional, IsUUID, IsEnum, IsBoolean } from 'class-validator';

export class CreateCommentInputDto {
  @IsString()
  @IsNotEmpty({ message: 'Comment text cannot be empty' })
  @MinLength(1, { message: 'Comment text must be at least 1 character' })
  @MaxLength(1000, { message: 'Comment text cannot exceed 1000 characters' })
  text: string;

  @IsOptional()
  @IsUUID('4', { message: 'Parent comment ID must be a valid UUID' })
  parentId?: string;
}

export class ModerateCommentInputDto {
  @IsEnum(['hide', 'unhide', 'delete'], {
    message: "Action must be one of: 'hide', 'unhide', 'delete'",
  })
  action: 'hide' | 'unhide' | 'delete';
}

export class CreateCollectionInputDto {
  @IsString()
  @IsNotEmpty({ message: 'Collection name is required' })
  @MinLength(1, { message: 'Collection name must be at least 1 character' })
  @MaxLength(100, { message: 'Collection name cannot exceed 100 characters' })
  name: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean = true;
}

export class AddReelToCollectionInputDto {
  @IsUUID('4', { message: 'Reel ID must be a valid UUID' })
  reelId: string;
}

export class ShareReelInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  platform?: string = 'internal';
}

export class RemixReelInputDto {
  @IsUUID('4', { message: 'Original reel ID must be a valid UUID' })
  originalReelId: string;

  @IsEnum(['DUET', 'REMIX', 'AUDIO_USE'], {
    message: "Remix type must be one of: 'DUET', 'REMIX', 'AUDIO_USE'",
  })
  remixType: 'DUET' | 'REMIX' | 'AUDIO_USE';
}
