import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  MinLength,
  MaxLength,
} from 'class-validator';

export class QueryAiAssistantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  query: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  targetInterestSlug?: string;

  @IsOptional()
  @IsBoolean()
  includeSummaries?: boolean;
}

export class SubmitAiQualityFeedbackDto {
  @IsString()
  messageId: string;

  @IsBoolean()
  isHelpful: boolean;

  @IsOptional()
  @IsIn(['ACCURATE', 'HALLUCINATION', 'IRRELEVANT', 'OFFENSIVE', 'OTHER'])
  feedbackCategory?:
    | 'ACCURATE'
    | 'HALLUCINATION'
    | 'IRRELEVANT'
    | 'OFFENSIVE'
    | 'OTHER';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comments?: string;
}

export class EnrollBetaDto {
  @IsBoolean()
  enrolled: boolean;
}
