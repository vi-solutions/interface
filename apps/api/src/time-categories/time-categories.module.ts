import { Module } from "@nestjs/common";
import { TimeCategoriesController } from "./time-categories.controller";
import { TimeCategoriesService } from "./time-categories.service";

@Module({
  controllers: [TimeCategoriesController],
  providers: [TimeCategoriesService],
  exports: [TimeCategoriesService],
})
export class TimeCategoriesModule {}
