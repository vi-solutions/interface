import { Module } from "@nestjs/common";
import { ProjectNotesController } from "./project-notes.controller";
import { ProjectNotesService } from "./project-notes.service";

@Module({
  controllers: [ProjectNotesController],
  providers: [ProjectNotesService],
  exports: [ProjectNotesService],
})
export class ProjectNotesModule {}
