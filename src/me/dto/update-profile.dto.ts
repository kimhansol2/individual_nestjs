import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  personaName?: string | null;

  @IsOptional()
  @IsString()
  avatar?: string | null;
}
