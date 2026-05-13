import { Module } from "@nestjs/common";
import { TimeEntriesController } from "./time-entries.controller";
import { TimeEntriesService } from "./time-entries.service";
import { ProjectUserRatesModule } from "../project-user-rates/project-user-rates.module";

@Module({
  imports: [ProjectUserRatesModule],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
