import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CreateProjectDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(240) summary?: string;
}

const ART_KEY = /^[a-z0-9-]{1,40}$/;

export class ReferenceDto {
  @IsUUID('all') uploadId!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsString() @MaxLength(100) mime!: string;
  @IsInt() @Min(0) size!: number;
}

export class InspirationDto {
  @IsUUID('all') id!: string;
  @IsIn(['art', 'upload']) source!: 'art' | 'upload';
  @ValidateIf((o: InspirationDto) => o.source === 'art') @IsString() @Matches(ART_KEY) artKey?: string;
  @ValidateIf((o: InspirationDto) => o.source === 'upload') @IsUUID('all') uploadId?: string;
  @IsString() @MaxLength(80) title!: string;
  @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(24, { each: true }) tags!: string[];
}

export class ConceptDto {
  @IsUUID('all') id!: string;
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
  @IsArray() @ArrayMaxSize(6) @IsString({ each: true }) @MaxLength(24, { each: true }) tags!: string[];
  @IsString() @MaxLength(300) description!: string;
  @IsString() @Matches(ART_KEY) artKey!: string;
  @IsBoolean() selected!: boolean;
}

export class BriefContentDto {
  @IsString() @MaxLength(60) fragranceType!: string;
  @IsString() @MaxLength(60) targetConsumer!: string;
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(24, { each: true })
  keywords!: string[];
  @IsString() @MaxLength(500) description!: string;
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ReferenceDto) references!: ReferenceDto[];
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => InspirationDto)
  inspirations!: InspirationDto[];
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ConceptDto) concepts!: ConceptDto[];
}

export class UpdateBriefDto {
  @IsInt() @Min(1) revision!: number;
  @ValidateNested() @Type(() => BriefContentDto) content!: BriefContentDto;
}
