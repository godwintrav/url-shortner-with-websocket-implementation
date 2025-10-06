import { IsNotEmpty, IsString } from 'class-validator';

export class CreateUrlDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsNotEmpty()
  clientId: string;
}
