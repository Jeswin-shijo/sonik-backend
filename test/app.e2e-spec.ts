import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { AppController } from './../src/app.controller';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let appController: AppController;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    appController = app.get(AppController);
  });

  it('returns the health payload', () => {
    expect(appController.getHealth()).toMatchObject({
      service: 'sonik-backend',
      status: 'ok',
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
