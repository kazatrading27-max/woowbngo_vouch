import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVouchersDto {
  @IsString()
  @MinLength(1)
  stationId: string;

  @IsInt()
  @Min(1)
  @Max(16777215)
  amount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(65535)
  daysValid?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  share?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  count?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class ValidateVoucherDto {
  @IsString()
  @MinLength(10)
  @MaxLength(64)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  uuid?: string;
}

export class ListVouchersQueryDto {
  @IsOptional()
  @IsString()
  stationId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'REDEEMED', 'REVOKED', 'EXPIRED'])
  status?: string;

  @IsOptional()
  @IsString()
  issuedById?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
