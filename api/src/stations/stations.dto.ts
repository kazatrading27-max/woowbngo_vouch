import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class CreateStationDto {
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  uuid: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  ownerName: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateStationDto {
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  uuid?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  ownerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
