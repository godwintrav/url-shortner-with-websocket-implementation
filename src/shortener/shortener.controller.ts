import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { CreateUrlDto } from './dto/create-url.dto';
import { ShortenerService } from './shortener.service';
import { Response } from 'express';

@Controller()
export class ShortenerController {
  constructor(private readonly shortenerService: ShortenerService) {}

  //this is the controller function used to shorten a url. please note shortened URL is sent with WebSocket and not this response.
  @Post('url')
  async shorten(@Body() dto: CreateUrlDto, @Res() res: Response) {
    await this.shortenerService.createShortUrl(dto.url, dto.clientId);

    return res.status(202).json({ status: 'accepted', message: 'result will be delivered over WebSocket' });
  }

  @Get(':code')
  async getOriginal(@Param('code') code: string, @Res() res: Response) {
    const url = await this.shortenerService.getOriginal(code);
    if (!url) {
      return res.status(404).json({ error: 'Short URL not found' });
    }
    return res.json({ url });
  }
}
