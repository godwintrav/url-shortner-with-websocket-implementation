import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageService],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('save', () => {
    it('should save a URL with a given code', async () => {
      const code = 'abc123';
      const url = 'https://example.com';

      await service.save(code, url);
      const stored = await service.get(code);

      expect(stored).toBe(url);
    });

    it('should overwrite an existing URL if the code already exists', async () => {
      const code = 'dup123';
      const firstUrl = 'https://first.com';
      const secondUrl = 'https://second.com';

      await service.save(code, firstUrl);
      let stored = await service.get(code);
      expect(stored).toBe(firstUrl);

      await service.save(code, secondUrl);
      stored = await service.get(code);
      expect(stored).toBe(secondUrl);
    });
  });

  describe('get', () => {
    it('should return the URL if the code exists', async () => {
      const code = 'xyz789';
      const url = 'https://test.com';
      await service.save(code, url);

      const result = await service.get(code);
      expect(result).toBe(url);
    });

    it('should return undefined if the code does not exist', async () => {
      const result = await service.get('nonexistent');
      expect(result).toBeUndefined();
    });
  });
});
