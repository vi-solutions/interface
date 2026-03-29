import { Module } from "@nestjs/common";
import { ClientsModule } from "../clients/clients.module";
import { QuickbooksController } from "./quickbooks.controller";
import { QuickbooksService } from "./quickbooks.service";
import { QboSyncService } from "./qbo-sync.service";

@Module({
  imports: [ClientsModule],
  controllers: [QuickbooksController],
  providers: [QuickbooksService, QboSyncService],
  exports: [QuickbooksService, QboSyncService],
})
export class QuickbooksModule {}
