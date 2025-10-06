import { Injectable } from '@nestjs/common';

@Injectable()
export class StorageService {
  private urlMap = new Map<string, string>();

  async save(code: string, url: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.urlMap.set(code, url);
        resolve();
      }, 50);
    });
  }

  async get(code: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.urlMap.get(code));
      }, 50);
    });
  }
}
