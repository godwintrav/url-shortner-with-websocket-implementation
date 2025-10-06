import { Injectable } from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import { StorageService } from '../storage/storage.service';
import { ShortenerGateway } from './ws.gateway';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ShortenerService {
  private alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  constructor(
    private readonly storage: StorageService,
    private readonly gateway: ShortenerGateway,
    private readonly configService: ConfigService
  ) {}

  //this function is used to iteratively generate new shortened code for a url using nanoid a unique string ID generator for JavaScript
  private async generateCode(): Promise<string> {
    let code = customAlphabet(this.alphabet, 5)();
    let isNewCode = false;

    //generate code in a loop to ensure no duplicate code is returned
    while(isNewCode == false){
      const exisitingShortUrl =  await this.getOriginal(code);
      if(!exisitingShortUrl){
        isNewCode = true;
        break;
      }
      code = customAlphabet(this.alphabet, 5)();
    }
    

    return code;
  }

  //this function creates a shortUrl and stores it with the storage service
  async createShortUrl(url: string, clientId: string) {
    const code = await this.generateCode();
    const shortened = `${this.configService.get('HOST_URL')}/${code}`;

    //store shortUrl asynchronously
    await this.storage.save(code, url);

    //send shortUrl with websocket and retry until client acknowledges
    this.gateway.sendShortenedURL(clientId, shortened);

    return shortened;
  }

  async getOriginal(code: string) {
    return this.storage.get(code);
  }
}
