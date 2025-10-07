import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateUrlDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({}, { message: 'url must be a valid URL' })
  url: string;

  @IsString()
  @IsNotEmpty()
  clientId: string;
}
