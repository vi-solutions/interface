import { Module } from "@nestjs/common";
import { ProjectTimeCategoriesService } from "./project-time-categories.service";
import { ProjectTimeCategoriesController } from "./project-time-categories.controller";

@Module({
  controllers: [ProjectTimeCategoriesController],
  providers: [ProjectTimeCategoriesService],
  exports: [ProjectTimeCategoriesService],
})
export class ProjectTimeCategoriesModule {}
