import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const PCT_PATTERN = /^\d{1,3}(\.\d{1,6})?$/;
export const GRAMS_PATTERN = /^\d{1,6}(\.\d{1,3})?$/;

export class DraftItemDto {
  @IsUUID('all') lineId!: string;
  @IsUUID('all') ingredientId!: string;
  @IsString()
  @Matches(PCT_PATTERN, {
    message: 'massPct must be a non-negative decimal string with at most 6 decimals (e.g. "12.500000")',
  })
  massPct!: string;
  @IsInt() @Min(0) position!: number;
}

export class UpdateDraftDto {
  @IsInt() @Min(1) revision!: number;
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => DraftItemDto)
  items!: DraftItemDto[];
  @IsOptional()
  @IsString()
  @Matches(GRAMS_PATTERN, { message: 'batchSizeG must be a positive decimal with at most 3 decimals' })
  batchSizeG?: string;
}

export class RevisionDto {
  @IsInt() @Min(1) revision!: number;
}

export class CreateVersionDto {
  @IsInt() @Min(1) expectedDraftRevision!: number;
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @Matches(/^[\w .\-()]+$/, { message: 'versionLabel may contain letters, numbers, space, . - ( ) _' })
  versionLabel!: string;
  @IsOptional() @IsUUID('all') parentVersionId?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class BranchDto {
  @IsOptional() @IsInt() @Min(1) expectedDraftRevision?: number;
}
