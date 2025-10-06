import { Injectable } from '@nestjs/common';

//This class handles storage for our application. This class will be responsible for getting urls and storing urls
@Injectable()
export class StorageService {
  private urlMap = new Map<string, string>();
  
  //This function will save the url in a map with the code as the key. Using setTimeout to replicate an async process.
  async save(code: string, url: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.urlMap.set(code, url);
        resolve();
      }, 50);
    });
  }

  //This function gets the url with the code set as the key
  async get(code: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.urlMap.get(code));
      }, 50);
    });
  }
}
