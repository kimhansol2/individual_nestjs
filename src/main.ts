import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { NoStoreIfAuthedInterceptor } from './common/interceptors/no-store.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser(process.env.COOKIE_SECRET));
  app.useGlobalInterceptors(new NoStoreIfAuthedInterceptor());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
