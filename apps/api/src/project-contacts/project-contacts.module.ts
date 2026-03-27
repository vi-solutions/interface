import { Module } from "@nestjs/common";
import { ProjectContactsController } from "./project-contacts.controller";
import { ProjectContactsService } from "./project-contacts.service";

@Module({
  controllers: [ProjectContactsController],
  providers: [ProjectContactsService],
  exports: [ProjectContactsService],
})
export class ProjectContactsModule {}
