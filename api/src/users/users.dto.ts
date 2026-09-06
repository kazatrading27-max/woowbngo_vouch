import { IsEmail, IsIn, IsOptional, IsString, IsBoolean, MinLength, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsIn(['ADMIN', 'AGENT'])
  role: 'ADMIN' | 'AGENT';
}

export class UpdateUserDto {
  @IsOptional()
  @IsIn(['ADMIN', 'AGENT'])
  role?: 'ADMIN' | 'AGENT';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;
}
