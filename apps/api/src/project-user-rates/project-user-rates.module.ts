import { Module } from "@nestjs/common";
import { ProjectUserRatesService } from "./project-user-rates.service";
import { ProjectUserRatesController } from "./project-user-rates.controller";

@Module({
  controllers: [ProjectUserRatesController],
  providers: [ProjectUserRatesService],
  exports: [ProjectUserRatesService],
})
export class ProjectUserRatesModule {}
