import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
//통합테스트만 작성을 하시면 됩니다..... (그러니까 jest 사용해서 통합테스트 진행하시면 되는데 ...
// 2분 중 블페상 CI/CD 하면 됩니다 gitaction 으로 쓰시면 됩니다.. 그리고 커버리지 80% 통과 안하면 안받아줍니다...
// 80% 통과해주세요...)
