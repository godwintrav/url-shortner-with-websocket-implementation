import { Test, TestingModule } from '@nestjs/testing';
import { ShortenerService } from './shortener.service';
import { StorageService } from '../storage/storage.service';
import { ShortenerGateway } from './ws.gateway';
import { ConfigService } from '@nestjs/config';

describe('ShortenerService', () => {
  let service: ShortenerService;
  let storageService: jest.Mocked<StorageService>;
  let gateway: jest.Mocked<ShortenerGateway>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockStorageService: Partial<StorageService> = {
      get: jest.fn(),
      save: jest.fn(),
    };

    const mockGateway: Partial<ShortenerGateway> = {
      sendShortenedURL: jest.fn(),
    };

    const mockConfigService: Partial<ConfigService> = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShortenerService,
        { provide: StorageService, useValue: mockStorageService },
        { provide: ShortenerGateway, useValue: mockGateway },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ShortenerService>(ShortenerService);
    storageService = module.get(StorageService);
    gateway = module.get(ShortenerGateway);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOriginal', () => {
    it('should return the original URL from storage', async () => {
      (storageService.get as jest.Mock).mockResolvedValue('https://example.com');

      const result = await service.getOriginal('abcde');
      expect(storageService.get).toHaveBeenCalledWith('abcde');
      expect(result).toBe('https://example.com');
    });

    it('should return null if code not found', async () => {
      (storageService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.getOriginal('notfound');
      expect(result).toBeNull();
    });
  });

  describe('generateCode', () => {
    it('should generate a unique code if first code is available', async () => {
      (storageService.get as jest.Mock).mockResolvedValueOnce(null);

      const code = await (service as any).generateCode();

      expect(typeof code).toBe('string');
      expect(code).toHaveLength(5);
      expect(storageService.get).toHaveBeenCalledTimes(1);
    });

    it('should retry generating code until a unique one is found', async () => {
      (storageService.get as jest.Mock)
        .mockResolvedValueOnce('https://already-taken.com')
        .mockResolvedValueOnce(null);

      const code = await (service as any).generateCode();

      expect(typeof code).toBe('string');
      expect(code).toHaveLength(5);
      expect(storageService.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('createShortUrl', () => {
    it('should generate, save and send shortened URL', async () => {
      (storageService.get as jest.Mock).mockResolvedValue(null);
      (storageService.save as jest.Mock).mockResolvedValue(undefined);

      const result = await service.createShortUrl('https://google.com', 'client-123');

      // The shortened URL must contain the HOST_URL and a 5-char code
      expect(result).toMatch(/^http:\/\/localhost:3000\/[a-zA-Z0-9]{5}$/);

      const savedCode = result.split('/').pop();
      expect(storageService.save).toHaveBeenCalledWith(savedCode, 'https://google.com');

      expect(gateway.sendShortenedURL).toHaveBeenCalledWith('client-123', result);
    });

    it('should generate different short URLs for different requests', async () => {
      (storageService.get as jest.Mock).mockResolvedValue(null);
      (storageService.save as jest.Mock).mockResolvedValue(undefined);

      const url1 = await service.createShortUrl('https://site1.com', 'c1');
      const url2 = await service.createShortUrl('https://site2.com', 'c2');

      expect(url1).not.toEqual(url2);
    });
  });
});
