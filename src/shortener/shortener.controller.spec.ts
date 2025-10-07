import { Test, TestingModule } from '@nestjs/testing';
import { ShortenerController } from './shortener.controller';
import { ShortenerService } from './shortener.service';
import { Response } from 'express';

describe('ShortenerController', () => {
  let controller: ShortenerController;
  let shortenerService: ShortenerService;

  // Create mock response object
    const mockResponse = () => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  const shortenerServiceMock = {
    createShortUrl: jest.fn(),
    getOriginal: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShortenerController],
      providers: [
        {
          provide: ShortenerService,
          useValue: shortenerServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ShortenerController>(ShortenerController);
    shortenerService = module.get<ShortenerService>(ShortenerService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('shorten (POST /url)', () => {
    it('should call service.createShortUrl with correct parameters and return 202', async () => {
      const dto = { url: 'https://example.com', clientId: 'client-123' };
      const res = mockResponse();

      await controller.shorten(dto as any, res);

      expect(shortenerService.createShortUrl).toHaveBeenCalledWith(dto.url, dto.clientId);
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({
        status: 'accepted',
        message: 'result will be delivered over WebSocket',
      });
    });

    it('should handle service errors gracefully', async () => {
      const dto = { url: 'https://example.com', clientId: 'client-123' };
      const res = mockResponse();

      (shortenerService.createShortUrl as jest.Mock).mockRejectedValueOnce(new Error('Service error'));

      await expect(controller.shorten(dto as any, res)).rejects.toThrow('Service error');
    });
  });

  describe('getOriginal (GET /:code)', () => {
    it('should return 200 and the original URL when found', async () => {
      const code = 'abc123';
      const res = mockResponse();
      (shortenerService.getOriginal as jest.Mock).mockResolvedValueOnce('https://example.com');

      await controller.getOriginal(code, res);

      expect(shortenerService.getOriginal).toHaveBeenCalledWith(code);
      expect(res.json).toHaveBeenCalledWith({ url: 'https://example.com' });
    });

    it('should return 404 when URL not found', async () => {
      const code = 'notfound';
      const res = mockResponse();
      (shortenerService.getOriginal as jest.Mock).mockResolvedValueOnce(null);

      await controller.getOriginal(code, res);

      expect(shortenerService.getOriginal).toHaveBeenCalledWith(code);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Short URL not found' });
    });

    it('should handle service errors gracefully', async () => {
      const code = 'err123';
      const res = mockResponse();
      (shortenerService.getOriginal as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

      await expect(controller.getOriginal(code, res)).rejects.toThrow('DB error');
    });
  });
});
